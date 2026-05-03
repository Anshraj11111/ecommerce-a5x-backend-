import { Resend } from 'resend';

/**
 * Email Service using Resend (works on Render — uses HTTPS not SMTP)
 *
 * Setup:
 * 1. Go to https://resend.com and sign up (free — 3000 emails/month)
 * 2. Create an API key
 * 3. Add to Render env vars:  RESEND_API_KEY=re_xxxxxxxxxxxx
 * 4. Verify your sender domain OR use onboarding@resend.dev for testing
 */

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// Sender address — use your verified domain or Resend's test address
function getSender() {
  return process.env.EMAIL_FROM || 'A5X Industries <onboarding@resend.dev>';
}
/**
 * Test email configuration
 */
export async function testEmailConfig() {
  const resend = getResend();
  if (!resend) {
    console.error('❌ RESEND_API_KEY not set in env vars');
    return { ok: false, error: 'RESEND_API_KEY missing' };
  }
  console.log('✅ Resend client created successfully');
  return { ok: true };
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(order) {
  const resend = getResend();
  if (!resend) {
    console.error('❌ RESEND_API_KEY not configured — skipping email');
    return;
  }

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
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: order.customerEmail,
      reply_to: process.env.EMAIL_USER || 'anshrajbaghel30@gmail.com',
      subject: `✅ Order Confirmed — #${order.orderNumber} | A5X Robotics`,
      html
    });

    if (error) {
      console.error('❌ Resend error:', error);
    } else {
      console.log(`✅ Confirmation email sent to ${order.customerEmail} (id: ${data?.id})`);
    }
  } catch (err) {
    console.error('❌ Email send failed:', err.message);
  }
}

/**
 * Send shipping notification email
 */
export async function sendShippingEmail(order) {
  const resend = getResend();
  if (!resend) {
    console.error('❌ RESEND_API_KEY not configured — skipping shipping email');
    return;
  }

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
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: order.customerEmail,
      reply_to: process.env.EMAIL_USER || 'anshrajbaghel30@gmail.com',
      subject: `🚚 Order Shipped — #${order.orderNumber} | A5X Robotics`,
      html
    });

    if (error) {
      console.error('❌ Resend shipping email error:', error);
    } else {
      console.log(`✅ Shipping email sent to ${order.customerEmail} (id: ${data?.id})`);
    }
  } catch (err) {
    console.error('❌ Shipping email failed:', err.message);
  }
}
