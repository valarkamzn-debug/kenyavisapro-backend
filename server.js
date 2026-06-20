const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// CORS - allow any origin
app.use(cors({
  origin: true,
  credentials: true
}));

// Parse JSON body
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'KenyaVisaPro Payment Server',
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Stripe payment server is running',
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'LIVE' : 'TEST'
  });
});

// Create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { items, customerEmail, customerName } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.title || 'Visa Service',
          description: 'Kenya eTA Visa Application',
        },
        unit_amount: (item.price || 100) * 100,
      },
      quantity: item.quantity || 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: 'https://kenyavisapro.com/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://kenyavisapro.com/?canceled=true',
      customer_email: customerEmail || undefined,
      metadata: {
        customer_name: customerName || '',
        service_type: items[0]?.serviceId || 'tourist',
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: 'Payment session creation failed', details: error.message });
  }
});

// Verify payment
app.get('/api/verify-payment', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'No session ID' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.json({
      status: session.payment_status,
      amountTotal: session.amount_total,
      customerEmail: session.customer_email,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
