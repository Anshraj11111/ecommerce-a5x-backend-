import express from 'express';
import Kit from '../models/Kit.js';
import Product from '../models/Product.js';

const router = express.Router();

// Smart rule-based AI responses about A5X Robotics
function generateResponse(userMessage, kits, products) {
  const msg = userMessage.toLowerCase().trim();

  // ── Greetings ──────────────────────────────────────────────
  if (/^(hi|hello|hey|namaste|hii|helo|sup|yo)\b/.test(msg)) {
    return "Hey! 👋 I'm Axie, your A5X Robotics assistant. Ask me about our kits, components, courses, or anything robotics-related!";
  }

  // ── Kits ───────────────────────────────────────────────────
  if (/kit|kits|robotics kit|starter kit|pro kit|elite kit/.test(msg)) {
    if (kits.length === 0) {
      return "We have amazing robotics kits! Visit our **Kits** page to explore them. Each kit comes with all components, instructions, and support.";
    }
    const kitList = kits.slice(0, 4).map(k =>
      `• **${k.name}** (${k.tier}) — ₹${Number(k.price).toLocaleString('en-IN')}`
    ).join('\n');
    return `Here are our popular kits:\n\n${kitList}\n\nVisit the **Kits** page for full details, specs, and to add to cart! 🤖`;
  }

  // ── Price / Cost ───────────────────────────────────────────
  if (/price|cost|how much|kitna|rate|pricing/.test(msg)) {
    if (kits.length > 0) {
      const prices = kits.map(k => Number(k.price));
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return `Our kits range from **₹${min.toLocaleString('en-IN')}** to **₹${max.toLocaleString('en-IN')}**. Individual components start from just ₹50. Check the Shop or Kits page for exact pricing! 💰`;
    }
    return "Our kits and components are competitively priced. Visit the **Shop** or **Kits** page for current pricing!";
  }

  // ── Arduino ────────────────────────────────────────────────
  if (/arduino/.test(msg)) {
    const arduinoProducts = products.filter(p =>
      p.name?.toLowerCase().includes('arduino') ||
      p.category?.toLowerCase().includes('arduino')
    ).slice(0, 3);
    if (arduinoProducts.length > 0) {
      const list = arduinoProducts.map(p => `• **${p.name}** — ₹${Number(p.price).toLocaleString('en-IN')}`).join('\n');
      return `We have Arduino boards and accessories:\n\n${list}\n\nFind them in the **Shop** under Microcontrollers! ⚡`;
    }
    return "Yes, we stock Arduino Uno, Nano, Mega and more! Head to the **Shop** → Microcontrollers section to browse all Arduino products.";
  }

  // ── ESP32 / ESP8266 ────────────────────────────────────────
  if (/esp32|esp8266|esp/.test(msg)) {
    return "We carry **ESP32** and **ESP8266** boards — perfect for IoT and WiFi projects! Check the **Shop** → Microcontrollers section. They're great for home automation and wireless robotics. 📡";
  }

  // ── Raspberry Pi ───────────────────────────────────────────
  if (/raspberry|raspberry pi|rpi/.test(msg)) {
    return "We stock **Raspberry Pi** boards and accessories! Great for AI projects, computer vision, and advanced robotics. Visit the **Shop** to see availability. 🍓";
  }

  // ── Sensors ────────────────────────────────────────────────
  if (/sensor|sensors|ultrasonic|infrared|ir sensor|temperature|humidity|motion/.test(msg)) {
    if (/distance|ultrasonic/.test(msg)) {
      return "For distance measurement, the **HC-SR04 Ultrasonic Sensor** is perfect! It measures 2cm–400cm with high accuracy. Available in our **Shop** → Sensors section. 📏";
    }
    if (/temperature|humidity/.test(msg)) {
      return "For temperature & humidity, we recommend the **DHT11** (budget) or **DHT22** (more accurate). Both available in the **Shop** → Sensors! 🌡️";
    }
    if (/motion|pir/.test(msg)) {
      return "The **PIR Motion Sensor** is great for motion detection projects! Available in our **Shop** → Sensors section. 👁️";
    }
    return "We have a wide range of sensors:\n\n• Ultrasonic (HC-SR04)\n• IR Sensors\n• Temperature (DHT11/DHT22)\n• PIR Motion\n• Soil Moisture\n• Light (LDR)\n\nBrowse all in **Shop** → Sensors! 🔬";
  }

  // ── Motors ─────────────────────────────────────────────────
  if (/motor|servo|stepper|dc motor|l298n|motor driver/.test(msg)) {
    if (/driver|l298n/.test(msg)) {
      return "The **L298N Motor Driver** is our most popular motor controller! It can drive 2 DC motors or 1 stepper motor. Perfect for robot cars. Available in the **Shop**! ⚙️";
    }
    if (/servo/.test(msg)) {
      return "We stock **SG90** (mini) and **MG996R** (high torque) servo motors. Great for robotic arms and steering mechanisms. Check the **Shop** → Motors! 🦾";
    }
    return "We carry all types of motors:\n\n• DC Motors (various RPM)\n• Servo Motors (SG90, MG996R)\n• Stepper Motors\n• Motor Drivers (L298N, L293D)\n\nFind them in **Shop** → Motors & Drivers! ⚙️";
  }

  // ── Robot Car ──────────────────────────────────────────────
  if (/robot car|car robot|line follower|obstacle|autonomous car/.test(msg)) {
    return "Building a robot car? You'll need:\n\n• **Arduino Uno** (brain)\n• **L298N Motor Driver**\n• **4x DC Motors + Wheels**\n• **Ultrasonic Sensor** (obstacle avoidance)\n• **IR Sensors** (line following)\n• **Battery + Chassis**\n\nOr grab our **Robot Car Kit** from the Kits page — everything included! 🚗";
  }

  // ── Courses / Learn ────────────────────────────────────────
  if (/course|learn|tutorial|workshop|training|class/.test(msg)) {
    return "A5X Academy offers free and paid courses:\n\n• **Robotics Zero to Hero** (Beginner)\n• **ESP32 IoT Masterclass** (Intermediate)\n• **AI & Machine Learning** (Advanced)\n\nVisit the **Learn** page to start! All courses include video tutorials and project guides. 🎓";
  }

  // ── Shipping / Delivery ────────────────────────────────────
  if (/ship|delivery|deliver|dispatch|courier|order/.test(msg)) {
    return "📦 **Shipping Info:**\n\n• Free shipping on orders above ₹999\n• Same/next business day dispatch\n• Pan-India delivery\n• Secure packaging for all components\n\nFor bulk orders, contact us for special rates!";
  }

  // ── Return / Refund ────────────────────────────────────────
  if (/return|refund|replace|warranty|broken|damaged/.test(msg)) {
    return "🔄 **Return Policy:**\n\n• 7-day hassle-free returns\n• Replacement for damaged/defective items\n• Contact us within 7 days of delivery\n\nReach us via the **Contact** page or email for quick resolution!";
  }

  // ── Payment ────────────────────────────────────────────────
  if (/payment|pay|upi|cod|cash|online payment|razorpay/.test(msg)) {
    return "💳 **Payment Options:**\n\n• UPI (GPay, PhonePe, Paytm)\n• Credit/Debit Cards\n• Net Banking\n• Cash on Delivery (COD)\n• EMI available on select orders\n\nAll payments are 100% secure!";
  }

  // ── About A5X ──────────────────────────────────────────────
  if (/about|who are you|a5x|company|jabalpur/.test(msg)) {
    return "**A5X Industries** is Jabalpur's premier robotics & AI education company! 🏭\n\nWe:\n• Conduct 4-day hands-on workshops for schools\n• Supply robotics kits & components\n• Offer online/offline courses\n• Support lab setup for institutions\n\nTrusted by schools across Tier 2 India! 🇮🇳";
  }

  // ── Contact ────────────────────────────────────────────────
  if (/contact|reach|support|help|phone|email|whatsapp/.test(msg)) {
    return "📞 **Contact A5X:**\n\nUse the **Contact** page to send us a message and we'll respond within 24 hours!\n\nFor urgent queries, reach out via WhatsApp or email through the contact form. We're here to help! 💬";
  }

  // ── Bulk Order ─────────────────────────────────────────────
  if (/bulk|wholesale|school order|large order|quantity/.test(msg)) {
    return "📦 **Bulk Orders:**\n\nWe offer special pricing for bulk orders!\n\n• Schools & institutions get educational discounts\n• Custom kit configurations available\n• Dedicated support for large orders\n\nContact us via the **Contact** page with your requirements! 🏫";
  }

  // ── Beginner / Getting Started ─────────────────────────────
  if (/beginner|start|new|first|basic|getting started|kahan se shuru/.test(msg)) {
    return "Welcome to robotics! 🎉 Here's how to start:\n\n1. **Starter Kit** — Get our beginner kit with everything included\n2. **Free Course** — Take our 'Robotics Zero to Hero' course\n3. **Arduino Uno** — The best first microcontroller\n\nVisit the **Learn** page for free tutorials! You'll be building robots in no time! 🤖";
  }

  // ── Thanks ─────────────────────────────────────────────────
  if (/thank|thanks|thankyou|shukriya|dhanyawad/.test(msg)) {
    return "You're welcome! 😊 Happy to help. Feel free to ask anything else about robotics, our products, or courses. Happy building! 🤖⚡";
  }

  // ── Default ────────────────────────────────────────────────
  return `I can help you with:\n\n• 🤖 **Robotics Kits** — Starter, Pro, Elite\n• 🔧 **Components** — Arduino, sensors, motors\n• 📚 **Courses** — Free & paid learning\n• 📦 **Orders** — Shipping, returns, payment\n• 🏫 **Workshops** — School programs\n\nWhat would you like to know more about?`;
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Get the latest user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      return res.status(400).json({ error: 'No user message found' });
    }

    // Fetch live data for context
    let kits = [];
    let products = [];
    try {
      kits = await Kit.find({ isPublished: true }).select('name tier price description').limit(10);
      products = await Product.find({ inStock: true }).select('name category price').limit(20);
    } catch (e) {
      // Continue without DB data
    }

    const reply = generateResponse(lastUserMsg.content, kits, products);

    res.json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
