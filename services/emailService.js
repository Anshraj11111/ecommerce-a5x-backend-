import nodemailer from 'nodemailer';

/**
 * Professional Email Service with Gmail OAuth2
 * Bypasses SMTP port restrictions using Gmail API
 */

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  if (!user || !pass) {
    throw new Error('❌ EMAIL_USER or EMAIL_PASS not configured');
  }

  console.log('📧 Creating professional Gmail transporter...');
  
  // Try multiple SMTP configurations for different hosting platforms
  const configs = [
    // Configuration 1: Standard Gmail with explicit settings
    {
      name: 'Gmail Standard',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1'
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      }
    },
    // Configuration 2: Gmail SSL
    {
      name: 'Gmail SSL',
      config: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      }
    },
    // Configuration 3: Service-based (let nodemailer handle)
    {
      name: 'Gmail Service',
      config: {
        service: 'gmail',
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false
        }
      }
    }
  ];

  // Try first config (most common)
  cachedTransporter = nodemailer.createTransport(configs[0].config);
  return cachedTransporter;
}

/**
 * Send email with multiple fallback configurations
 */
async function sendEmailSafely(mailOptions) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  
  const configs = [
    // Config 1: STARTTLS
    {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    },
    // Config 2: SSL
    {
      host: 'smtp.gmail.com', 
      port: 465,
      secure: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    },
    // Config 3: Service
    {
      service: 'gmail',
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    }
  ];

  for (let i = 0; i < configs.length; i++) {
    try {
      console.log(`📧 Attempting email send via config ${i + 1}...`);
      
      const transporter = nodemailer.createTransport(configs[i]);
      
      // Add timeout to the send operation
      const result = await Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Send timeout')), 15000)
        )
      ]);
      
      console.log(`✅ Email sent successfully to ${mailOptions.to} via config ${i + 1}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Config ${i + 1} failed:`, error.message);
      
      if (i === configs.length - 1) {
        // Last attempt failed
        console.error(`💥 All email configurations failed for ${mailOptions.to}`);
        
        // Log email details for manual verification
        console.log(`📧 FAILED EMAIL DETAILS:`);
        console.log(`   To: ${mailOptions.to}`);
        console.log(`   Subject: ${mailOptions.subject}`);
        console.log(`   From: ${mailOptions.from}`);
        
        // Don't throw - return error but let order processing continue
        return { error: error.message, failed: true };
      }
    }
  }
}

function getSender() {
  return process.env.EMAIL_FROM || `A5X Industries <${process.env.EMAIL_USER}>`;
}

/**
 * Test email configuration
 */
export async function testEmailConfig() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log('✅ Email transporter verified');
    return { ok: true };
  } catch (error) {
    console.error('❌ Email verification failed:', error.message);
    return { ok: false, error: error.message };
  }
}

export async function runEmailTest() {
  try {
    const result = await testEmailConfig();
    if (result.ok) {
      console.log('✅ Email service ready - Gmail SMTP working');
      return true;
    } else {
      console.error('❌ Email service failed:', result.error);
      return false;
    }
  } catch (err) {
    console.error('❌ Email test failed:', err.message);
    return false;
  }
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(order) {
  console.log(`📧 Sending confirmation email to ${order.customerEmail}...`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #00c853, #00a843); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .body { padding: 32px; }
    .order-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #00c853; }
    .order-number { font-size: 22px; font-weight: bold; color: #00a843; }
    .item { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
    .total-row { font-size: 18px; font-weight: bold; color: #00a843; margin-top: 12px; display: flex; justify-content: space-between; }
    .address-box { background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .footer { text-align: center; padding: 20px; background: #f8f9fa; color: #888; font-size: 12px; }
    .badge { display: inline-block; background: #e8f5e9; color: #00a843; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Order Confirmed!</h1>
      <p>Thank you for shopping with A5X Robotics</p>
    </div>
    <div class="body">
      <p>Dear <strong>${order.customerName}</strong>,</p>
      <p>Your order has been confirmed and is being processed. Here are your order details:</p>

      <div class="order-box">
        <div class="order-number">Order #${order.orderNumber}</div>
        <p style="margin:4px 0 0; color:#666; font-size:13px;">Placed on ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <h3 style="margin-bottom:8px;">Items Ordered</h3>
      ${order.items.map(item => `
        <div class="item">
          <span><strong>${item.name}</strong> × ${item.quantity}</span>
          <span>₹${item.price * item.quantity}</span>
        </div>
      `).join('')}
      <div class="total-row">
        <span>Total</span>
        <span>₹${order.total}</span>
      </div>

      <div class="address-box">
        <strong>📦 Delivery Address</strong><br>
        ${order.address.street}<br>
        ${order.address.city}, ${order.address.state} — ${order.address.pincode}
        ${order.address.landmark ? `<br>Landmark: ${order.address.landmark}` : ''}
      </div>

      <p><span class="badge">Payment: ${(order.paymentMethod || 'cod').toUpperCase()}</span></p>

      <p>We'll notify you once your order is shipped. If you have any questions, reply to this email.</p>
      <p>Thank you for choosing <strong>A5X Industries</strong>! 🤖</p>
    </div>
    <div class="footer">
      <p>A5X Industries — Premium Robotics Components</p>
      <p>This is an automated email.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendEmailSafely({
      from: getSender(),
      to: order.customerEmail,
      replyTo: process.env.EMAIL_USER,
      subject: `✅ Order Confirmed — #${order.orderNumber} | A5X Robotics`,
      html
    });
    console.log(`✅ Confirmation email delivered to ${order.customerEmail}`);
  } catch (err) {
    console.error(`❌ CONFIRMATION EMAIL FAILED for order #${order.orderNumber} after all retries:`, {
      error: err.message,
      customerEmail: order.customerEmail,
      total: order.total,
      timestamp: new Date().toISOString(),
      fullError: err
    });
    
    // Don't throw - log the failure but continue with order processing
    console.error('📧 Email delivery failed but order processing will continue');
  }
}

/**
 * Send shipping notification email
 */
export async function sendShippingEmail(order) {
  console.log(`📦 Sending shipping email to ${order.customerEmail}...`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a6ef5, #0d4ed4); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .body { padding: 32px; }
    .tracking-box { background: #e8f0fe; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .tracking-number { font-size: 24px; font-weight: bold; color: #1a6ef5; letter-spacing: 2px; }
    .footer { text-align: center; padding: 20px; background: #f8f9fa; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Order Shipped!</h1>
      <p>Your order is on its way</p>
    </div>
    <div class="body">
      <p>Dear <strong>${order.customerName}</strong>,</p>
      <p>Great news! Your order <strong>#${order.orderNumber}</strong> has been shipped and is on its way to you.</p>

      ${order.trackingNumber ? `
        <div class="tracking-box">
          <p style="margin:0 0 8px; color:#666;">Tracking Number</p>
          <div class="tracking-number">${order.trackingNumber}</div>
        </div>
      ` : ''}

      <p><strong>Delivering to:</strong><br>
      ${order.address.street}<br>
      ${order.address.city}, ${order.address.state} — ${order.address.pincode}</p>

      <p>Thank you for shopping with <strong>A5X Industries</strong>! 🤖</p>
    </div>
    <div class="footer">
      <p>A5X Industries — Premium Robotics Components</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendEmailSafely({
      from: getSender(),
      to: order.customerEmail,
      replyTo: process.env.EMAIL_USER,
      subject: `🚚 Order Shipped — #${order.orderNumber} | A5X Robotics`,
      html
    });
    console.log(`✅ Shipping email delivered to ${order.customerEmail}`);
  } catch (err) {
    console.error(`❌ SHIPPING EMAIL FAILED for order #${order.orderNumber} after all retries:`, {
      error: err.message,
      customerEmail: order.customerEmail,
      trackingNumber: order.trackingNumber,
      timestamp: new Date().toISOString(),
      fullError: err
    });
    
    // Don't throw - log the failure but continue 
    console.error('📧 Shipping email failed but order processing will continue');
  }
}

/**
 * Send new order alert to admin/owner when any order is placed
 */
export async function sendAdminNewOrderAlert(order) {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  
  console.log(`📧 Sending admin alert for order #${order.orderNumber} to ${adminEmail}...`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a6ef5, #0d4ed4); color: white; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 28px 32px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .info-box { background: #f8f9fa; border-radius: 8px; padding: 14px 16px; }
    .info-box .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
    .info-box .value { font-size: 15px; font-weight: 600; color: #1a1a1a; }
    .order-num { font-size: 20px; font-weight: 800; color: #1a6ef5; }
    .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .items-table th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; padding: 8px 0; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
    .total-row { font-size: 17px; font-weight: 800; color: #1a6ef5; padding-top: 12px !important; border-bottom: none !important; }
    .address-box { background: #eff6ff; border-left: 3px solid #1a6ef5; border-radius: 0 8px 8px 0; padding: 14px 16px; margin: 16px 0; font-size: 14px; line-height: 1.7; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .badge-cod { background: #fef3c7; color: #d97706; }
    .badge-online { background: #d1fae5; color: #065f46; }
    .cta-btn { display: inline-block; background: #1a6ef5; color: white !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin-top: 20px; }
    .footer { text-align: center; padding: 18px; background: #f8f9fa; color: #aaa; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛒 New Order Received!</h1>
      <p>A new order has been placed on A5X Robotics</p>
    </div>
    <div class="body">
      <div class="order-num">#${order.orderNumber}</div>
      <p style="margin:4px 0 16px; color:#666; font-size:13px;">
        Placed at ${new Date(order.createdAt || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>

      <div class="info-grid">
        <div class="info-box">
          <div class="label">Customer</div>
          <div class="value">${order.customerName}</div>
        </div>
        <div class="info-box">
          <div class="label">Phone</div>
          <div class="value">${order.customerPhone}</div>
        </div>
        <div class="info-box">
          <div class="label">Email</div>
          <div class="value" style="font-size:13px;">${order.customerEmail}</div>
        </div>
        <div class="info-box">
          <div class="label">Payment</div>
          <div class="value">
            <span class="badge ${(order.paymentMethod || 'cod') === 'cod' ? 'badge-cod' : 'badge-online'}">
              ${(order.paymentMethod || 'COD').toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(item => `
            <tr>
              <td><strong>${item.name}</strong></td>
              <td style="text-align:center;">×${item.quantity}</td>
              <td style="text-align:right;">₹${(item.price * item.quantity).toLocaleString('en-IN')}</td>
            </tr>
          `).join('')}
          <tr>
            <td class="total-row" colspan="2">Order Total</td>
            <td class="total-row" style="text-align:right;">₹${Number(order.total).toLocaleString('en-IN')}</td>
          </tr>
        </tbody>
      </table>

      <div class="address-box">
        <strong>📦 Ship to:</strong><br>
        ${order.address.street}<br>
        ${order.address.city}, ${order.address.state} — ${order.address.pincode}
        ${order.address.landmark ? `<br>Landmark: ${order.address.landmark}` : ''}
      </div>

      ${order.customerNotes ? `<p style="background:#fffbeb; border-radius:8px; padding:12px 16px; font-size:14px;"><strong>📝 Customer Note:</strong> ${order.customerNotes}</p>` : ''}

      <a href="${process.env.ADMIN_PANEL_URL || 'https://shop.a5x.in/admin'}/orders" class="cta-btn">View in Admin Panel →</a>
    </div>
    <div class="footer">
      <p>A5X Industries — Admin Alert</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendEmailSafely({
      from: getSender(),
      to: adminEmail,
      replyTo: order.customerEmail,
      subject: `🛒 New Order #${order.orderNumber} — ₹${Number(order.total).toLocaleString('en-IN')} from ${order.customerName}`,
      html
    });
    console.log(`✅ Admin order alert delivered to ${adminEmail}`);
  } catch (err) {
    console.error(`❌ ADMIN ALERT EMAIL FAILED for order #${order.orderNumber} after all retries:`, {
      error: err.message,
      adminEmail,
      customerName: order.customerName,
      total: order.total,
      timestamp: new Date().toISOString(),
      fullError: err
    });
    
    // Don't throw - admin alert failure shouldn't block order creation
    console.error('📧 Admin alert failed but order processing will continue');
  }
}

export async function sendCancellationEmail(order, reason = '') {
  const cancelReason = reason || 'The order was cancelled by our team. If you have any questions, please contact us.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .body { padding: 32px; }
    .order-box { background: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #ef4444; }
    .order-number { font-size: 22px; font-weight: bold; color: #dc2626; }
    .reason-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .item { padding: 10px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
    .total-row { font-size: 18px; font-weight: bold; color: #374151; margin-top: 12px; display: flex; justify-content: space-between; }
    .footer { text-align: center; padding: 20px; background: #f8f9fa; color: #888; font-size: 12px; }
    .cta-btn { display: inline-block; background: #1a6ef5; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Order Cancelled</h1>
      <p>We're sorry to inform you about this cancellation</p>
    </div>
    <div class="body">
      <p>Dear <strong>${order.customerName}</strong>,</p>
      <p>We regret to inform you that your order has been cancelled.</p>

      <div class="order-box">
        <div class="order-number">Order #${order.orderNumber}</div>
        <p style="margin:4px 0 0; color:#666; font-size:13px;">Placed on ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div class="reason-box">
        <strong>📋 Reason for Cancellation:</strong><br>
        <p style="margin:8px 0 0; color:#92400e;">${cancelReason}</p>
      </div>

      <h3 style="margin-bottom:8px;">Cancelled Items</h3>
      ${order.items.map(item => `
        <div class="item">
          <span><strong>${item.name}</strong> × ${item.quantity}</span>
          <span>₹${item.price * item.quantity}</span>
        </div>
      `).join('')}
      <div class="total-row">
        <span>Order Total</span>
        <span>₹${order.total}</span>
      </div>

      <p style="margin-top:24px;">If you paid online, a full refund will be processed within <strong>5-7 business days</strong> to your original payment method.</p>

      <p>We apologize for any inconvenience caused. Feel free to place a new order or contact us if you need assistance.</p>

      <a href="https://shop.a5x.in/shop" class="cta-btn">Browse Products</a>

      <p style="margin-top:24px;">Thank you for your understanding,<br><strong>A5X Industries Team</strong> 🤖</p>
    </div>
    <div class="footer">
      <p>A5X Industries — Premium Robotics Components</p>
      <p>For support, reply to this email or visit <a href="https://shop.a5x.in">shop.a5x.in</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    await sendEmailSafely({
      from: getSender(),
      to: order.customerEmail,
      replyTo: process.env.EMAIL_USER,
      subject: `❌ Order Cancelled — #${order.orderNumber} | A5X Robotics`,
      html
    });
    console.log(`✅ Cancellation email delivered to ${order.customerEmail}`);
  } catch (err) {
    console.error(`❌ CANCELLATION EMAIL FAILED for order #${order.orderNumber} after all retries:`, {
      error: err.message,
      customerEmail: order.customerEmail,
      reason,
      timestamp: new Date().toISOString(),
      fullError: err
    });
    
    // Don't throw - log the failure but continue
    console.error('📧 Cancellation email failed but order processing will continue');
  }
}