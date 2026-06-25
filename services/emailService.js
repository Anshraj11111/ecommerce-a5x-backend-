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

/**
 * Send new order alert to admin/owner when any order is placed
 */
export async function sendAdminNewOrderAlert(order) {
  const resend = getResend();
  if (!resend) return;

  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'anshrajbaghel30@gmail.com';

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
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: adminEmail,
      subject: `🛒 New Order #${order.orderNumber} — ₹${Number(order.total).toLocaleString('en-IN')} from ${order.customerName}`,
      html
    });

    if (error) {
      console.error('❌ Admin alert email error:', error);
    } else {
      console.log(`✅ Admin order alert sent to ${adminEmail} (id: ${data?.id})`);
    }
  } catch (err) {
    console.error('❌ Admin alert email failed:', err.message);
  }
}


export async function sendCancellationEmail(order, reason = '') {
  const resend = getResend();
  if (!resend) {
    console.error('❌ RESEND_API_KEY not configured — skipping cancellation email');
    return;
  }

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
    const { data, error } = await resend.emails.send({
      from: getSender(),
      to: order.customerEmail,
      reply_to: process.env.EMAIL_USER || 'anshrajbaghel30@gmail.com',
      subject: `❌ Order Cancelled — #${order.orderNumber} | A5X Robotics`,
      html
    });

    if (error) {
      console.error('❌ Resend cancellation email error:', error);
    } else {
      console.log(`✅ Cancellation email sent to ${order.customerEmail} (id: ${data?.id})`);
    }
  } catch (err) {
    console.error('❌ Cancellation email failed:', err.message);
  }
}
