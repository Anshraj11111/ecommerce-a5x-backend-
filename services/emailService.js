import nodemailer from 'nodemailer';

/**
 * Email Service using Gmail (FREE)
 * 
 * Setup Instructions:
 * 1. Go to https://myaccount.google.com/apppasswords
 * 2. Create an "App Password" for "Mail"
 * 3. Copy the 16-character password
 * 4. Add to .env file:
 *    EMAIL_USER=your-email@gmail.com
 *    EMAIL_PASS=your-app-password
 */

// Create transporter
let transporter = null;

function getTransporter() {
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(order) {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 Email not configured. Skipping email notification.');
    console.log('📧 Would send to:', order.customerEmail);
    return;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a6ef5, #0d4ed4); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .order-number { font-size: 24px; font-weight: bold; color: #1a6ef5; }
    .item { padding: 10px 0; border-bottom: 1px solid #eee; }
    .total { font-size: 20px; font-weight: bold; color: #0d4ed4; margin-top: 15px; }
    .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Order Confirmed!</h1>
      <p>Thank you for your order</p>
    </div>
    <div class="content">
      <p>Dear <strong>${order.customerName}</strong>,</p>
      
      <p>Your order has been confirmed and is being processed!</p>
      
      <div class="order-details">
        <div class="order-number">Order #${order.orderNumber}</div>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
        
        <h3>Items Ordered:</h3>
        ${order.items.map(item => `
          <div class="item">
            <strong>${item.name}</strong><br>
            Quantity: ${item.quantity} × ₹${item.price} = ₹${item.quantity * item.price}
          </div>
        `).join('')}
        
        <div class="total">Total: ₹${order.total}</div>
        
        <h3>Delivery Address:</h3>
        <p>
          ${order.address.street}<br>
          ${order.address.city}, ${order.address.state} - ${order.address.pincode}
          ${order.address.landmark ? `<br>Landmark: ${order.address.landmark}` : ''}
        </p>
        
        <p><strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
      </div>
      
      <p>We will notify you once your order is shipped.</p>
      
      <p>If you have any questions, feel free to contact us.</p>
      
      <p>Thank you for shopping with <strong>A5X Industries</strong>!</p>
      
      <p>Best regards,<br>
      <strong>A5X Robotics Team</strong></p>
    </div>
    <div class="footer">
      <p>A5X Industries - Premium Robotics Components</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transport.sendMail({
      from: `"A5X Industries" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: `Order Confirmed - #${order.orderNumber}`,
      html: emailContent
    });
    
    console.log(`✅ Order confirmation email sent to ${order.customerEmail}`);
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
  }
}

/**
 * Send shipping notification email
 */
export async function sendShippingEmail(order) {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 Email not configured. Skipping shipping notification.');
    return;
  }

  const emailContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #00c853, #00a843); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .tracking { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
    .tracking-number { font-size: 24px; font-weight: bold; color: #00c853; letter-spacing: 2px; }
    .footer { text-align: center; color: #666; margin-top: 30px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Order Shipped!</h1>
      <p>Your order is on its way</p>
    </div>
    <div class="content">
      <p>Dear <strong>${order.customerName}</strong>,</p>
      
      <p>Great news! Your order <strong>#${order.orderNumber}</strong> has been shipped!</p>
      
      ${order.trackingNumber ? `
        <div class="tracking">
          <p><strong>Tracking Number:</strong></p>
          <div class="tracking-number">${order.trackingNumber}</div>
        </div>
      ` : ''}
      
      <p>Your order will be delivered soon to:</p>
      <p>
        <strong>${order.address.street}</strong><br>
        ${order.address.city}, ${order.address.state} - ${order.address.pincode}
      </p>
      
      <p>Thank you for shopping with <strong>A5X Industries</strong>!</p>
      
      <p>Best regards,<br>
      <strong>A5X Robotics Team</strong></p>
    </div>
    <div class="footer">
      <p>A5X Industries - Premium Robotics Components</p>
      <p>This is an automated email. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transport.sendMail({
      from: `"A5X Industries" <${process.env.EMAIL_USER}>`,
      to: order.customerEmail,
      subject: `Order Shipped - #${order.orderNumber}`,
      html: emailContent
    });
    
    console.log(`✅ Shipping notification email sent to ${order.customerEmail}`);
  } catch (error) {
    console.error('❌ Error sending shipping email:', error.message);
  }
}
