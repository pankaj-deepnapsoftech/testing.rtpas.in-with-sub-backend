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
  const plan = req.body.plan || 'RTPAS';
  const period = req.body.period || 'month';

  // Calculate end date based on period
  const startDate = new Date();
  const endDate = new Date(startDate);

  if (period === 'year') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Set time to midnight
  endDate.setHours(0, 0, 0, 0);

  // Prefer amount provided by client (in paise) for dynamic pricing
  let amountInPaise = null;
  if (req.body && req.body.amount) {
    const provided = parseInt(req.body.amount, 10);
    if (!Number.isNaN(provided) && provided > 0) {
      amountInPaise = provided;
    }
  }

  // Fallback to configured/default if client didn't provide amount
  if (!amountInPaise) {
    amountInPaise = (parseInt(process.env.RAZORPAY_DEFAULT_AMOUNT_INR || '1000', 10) * 100);
  }
  let planInfo = null;
  try {
    const envPlanId = process.env.RAZORPAY_PLAN_ID_PREMIUM;
    if (envPlanId) {
      const fetchedPlan = await razorpay.plans.fetch(envPlanId);
      // Only override amount from plan if client didn't send explicit amount
      amountInPaise = amountInPaise || (fetchedPlan?.amount ?? amountInPaise);
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
    startDate,
    endDate,
    period,
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
    plan: order?.plan || 'RTPAS',
    amount: order?.amount || fallbackAmount,
    currency: 'INR',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
    status: 'paid',
    startDate: order?.startDate || new Date(),
    endDate: order?.endDate,
    period: order?.period || 'month',
  });

  if (order?.userId) {
    await User.findByIdAndUpdate(order.userId, { isSubscribed: true });
  }

  return res.status(StatusCodes.OK).json({ success: true, message: 'Payment verified' });
});

exports.renewSubscription = TryCatch(async (req, res) => {
  const razorpay = getRazorpayClient();
  const userId = req.user?._id || null;
  const { plan, amount, period } = req.body;

  if (!userId) {
    throw new ErrorHandler('User not authenticated', 401);
  }

  if (!plan) {
    throw new ErrorHandler('Plan is required', 400);
  }

  // Find the last subscription payment for this user
  const lastPayment = await SubscriptionPayment.findOne({ userId }).sort({ createdAt: -1 });
  if (!lastPayment) {
    throw new ErrorHandler('No previous subscription found', 404);
  }

  // Verify subscription has expired
  if (new Date() < lastPayment.endDate) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Subscription is still active. Renewal not yet eligible.',
      endDate: lastPayment.endDate,
    });
  }

  const renewalPeriod = period || lastPayment.period || 'month';
  let amountInPaise = amount || (lastPayment.amount);

  // Calculate new end date based on period
  const renewalStartDate = new Date();
  const renewalEndDate = new Date(renewalStartDate);
  if (renewalPeriod === 'year') {
    renewalEndDate.setFullYear(renewalEndDate.getFullYear() + 1);
  } else {
    renewalEndDate.setMonth(renewalEndDate.getMonth() + 1);
  }

  // Create new Razorpay order for renewal
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `renew_${Date.now()}`,
    notes: { plan, renewal: true },
  });

  // Create new SubscriptionOrder for renewal
  await SubscriptionOrder.create({
    userId,
    plan,
    amount: amountInPaise,
    currency: 'INR',
    razorpayOrderId: order.id,
    status: 'created',
    startDate: renewalStartDate,
    endDate: renewalEndDate,
    period: renewalPeriod,
  });

  return res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Renewal order created. Proceed to payment.',
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      previousEndDate: lastPayment.endDate,
      newEndDate: renewalEndDate,
    },
  });
});


exports.AllUsersSubscription = TryCatch(async (req, res) => {

  const data = await User.aggregate([
    {
      $match: { isSuper: true }
    },
    {
      $lookup: {
        from: "subscriptionpayments",
        localField: "_id",
        foreignField: "userId",
        as: "subscription"
      }
    },
    {
      $addFields: {

        // Reverse subscription array and get the first item (latest)
        subscription: {
          $arrayElemAt: [
            { $reverseArray: "$subscription" },
            0
          ]
        },

        // Count total subscriptions
        subscription_count: { $size: "$subscription" } // ⚠️ This is wrong; we’ll fix it below
      }
    },
    {
      $project: {
        subscription: 1,
        subscription_count: 1,
        first_name: 1,
        last_name: 1,
        email: 1,
        phone: 1,
        isVerified: 1,
        createdAt: 1,
        address: 1,
        cpny_name: 1,
      }
    }
  ]);

  res.status(StatusCodes.OK).json({
    data
  })

});

exports.allAdminCardsData = TryCatch(async (req, res) => {

  const [totalAdmins, freeTrialAgg, activePaid, expiredPaidAgg] = await Promise.all([

    // Total admins
    User.countDocuments({ isSuper: true }),

    // Free Trial (LAST per user, expired)
    SubscriptionPayment.aggregate([
      {
        $match: {
          plan: "Free Trial",
          endDate: { $lte: new Date() }
        }
      },
      { $sort: { endDate: -1 } },
      {
        $group: {
          _id: "$userId",
          lastSubscription: { $first: "$$ROOT" }
        }
      },
      { $count: "total" }
    ]),

    // Paid subscriptions active
    SubscriptionPayment.countDocuments({
      plan: { $ne: "Free Trial" },
      endDate: { $gte: new Date() }
    }),

    // Paid subscriptions expired (LAST per user)
    SubscriptionPayment.aggregate([
      {
        $match: {
          plan: { $ne: "Free Trial" },
          endDate: { $lte: new Date() }
        }
      },
      { $sort: { endDate: -1 } },
      {
        $group: {
          _id: "$userId",
          lastSubscription: { $first: "$$ROOT" }
        }
      },
      { $count: "total" }
    ])
  ]);

  const freeTrialCount = freeTrialAgg[0]?.total || 0;
  const expiredPaidCount = expiredPaidAgg[0]?.total || 0;

  res.status(StatusCodes.OK).json({
    data: {
      totalAdmins,
      freeTrial: freeTrialCount,
      activePaid,
      expiredPaid: expiredPaidCount,
      RTPAS:0,
      KONTROLIX:0
    }
  });
});

