const { SubscriptionOrder } = require('../models/subscription.model');
const { SubscriptionPayment } = require('../models/SubscriptionPayment.model');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { StatusCodes } = require('http-status-codes');
const { TryCatch, ErrorHandler } = require('../utils/error');
const User = require('../models/user');

const getRazorpayClient = () => {
    const keyId = process.env.RAZORPAY_KEY_ID || config.RAZORPAY_KEY_ID;
    const { SubscriptionOrder } = require('../models/subscriptionOrder');
    const { SubscriptionPayment } = require('../models/subscriptionPayment');
    const crypto = require('crypto');
    const Razorpay = require('razorpay');
    const { StatusCodes } = require('http-status-codes');
    const { TryCatch, ErrorHandler } = require('../utils/error');
    const User = require('../models/user');

    const getRazorpayClient = () => {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        throw new Error('Razorpay keys missing in environment (.env)');
      }
      return new Razorpay({ key_id: keyId, key_secret: keySecret });
    };

    exports.createOrder = TryCatch(async (req, res) => {
      const razorpay = getRazorpayClient();
      const userId = req.user?._id || null;
      const plan = req.body.plan || 'premium';

      let amountInPaise = (parseInt(process.env.RAZORPAY_DEFAULT_AMOUNT_INR || '1000', 10) * 100);
      let planInfo = null;
      try {
        const envPlanId = process.env.RAZORPAY_PLAN_ID_PREMIUM;
        if (envPlanId) {
          const fetchedPlan = await razorpay.plans.fetch(envPlanId);
          amountInPaise = fetchedPlan?.amount ?? amountInPaise;
          planInfo = {
            id: fetchedPlan?.id,
            amount: fetchedPlan?.amount,
            currency: fetchedPlan?.currency,
            interval: fetchedPlan?.interval,
            period: fetchedPlan?.period,
            item: fetchedPlan?.item,
          };
        }
      } catch (e) {
        // ignore plan fetch errors and use default
      }

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `sub_${Date.now()}`,
        notes: { plan },
      });

      await SubscriptionOrder.create({
        userId,
        plan,
        amount: amountInPaise,
        currency: 'INR',
        razorpayOrderId: order.id,
        status: 'created',
      });

      return res.status(StatusCodes.CREATED).json({
        success: true,
        data: {
          orderId: order.id,
          amount: order.amount,
          currency: order.currency,
          plan: planInfo,
        },
      });
    });

    exports.verifyPayment = TryCatch(async (req, res) => {
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error('Razorpay secret missing in environment (.env)');
      }

      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expected = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

      if (expected !== razorpay_signature) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Signature mismatch' });
      }

      const order = await SubscriptionOrder.findOne({ razorpayOrderId: razorpay_order_id });
      if (order) {
        order.status = 'paid';
        await order.save();
      }

      const fallbackAmount = (parseInt(process.env.RAZORPAY_DEFAULT_AMOUNT_INR || '1000', 10) * 100);
      await SubscriptionPayment.create({
        userId: order?.userId,
        plan: order?.plan || 'premium',
        amount: order?.amount || fallbackAmount,
        currency: 'INR',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: 'paid',
      });

  

      return res.status(StatusCodes.OK).json({ success: true, message: 'Payment verified' });
    });
};