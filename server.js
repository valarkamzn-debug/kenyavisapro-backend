const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

let sgMail = null;
if (process.env.SENDGRID_API_KEY) {
  sgMail = require('@sendgrid/mail');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'info@kenyavisapro.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@kenyavisapro.com';

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'KenyaVisaPro Payment Server', emailConfigured: !!sgMail });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', emailConfigured: !!sgMail });
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, visaType, message } = req.body;
    if (!name || !email || !visaType) return res.status(400).json({ error: 'Required' });
    
    if (sgMail) {
      await sgMail.send({
        from: { email: FROM_EMAIL, name: 'KenyaVisaPro' },
        to: ADMIN_EMAIL,
        subject: 'New Contact - ' + name,
        text: 'Name: ' + name + '\nEmail: ' + email + '\nPhone: ' + (phone || 'N/A') + '\nVisa: ' + visaType + '\n\nMessage: ' + (message || 'None')
      });
      await sgMail.send({
        from: { email: FROM_EMAIL, name: 'KenyaVisaPro' },
        to: email,
        subject: 'We received your message - KenyaVisaPro',
        text: 'Hi ' + name + ',\n\nThank you for contacting us about ' + visaType + ". We'll get back to you within 24 hours.\n\nCall/WhatsApp: +1 (774) 578-8068"
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Stripe not configured' });
    const { items, customerEmail, customerName } = req.body;
    const lineItems = items.map(item => ({
      price_data: { currency: 'usd', product_data: { name: item.title || 'Visa Service' }, unit_amount: (item.price || 100) * 100 },
      quantity: item.quantity || 1,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], line_items: lineItems, mode: 'payment',
      success_url: (req.headers.origin || 'https://kenyavisapro.com') + '/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: (req.headers.origin || 'https://kenyavisapro.com') + '/?canceled=true',
      customer_email: customerEmail || undefined,
      metadata: { customer_name: customerName || '', service_type: items[0]?.serviceId || 'tourist' },
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
Add contact form email support"
