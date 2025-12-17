const mongoose = require('mongoose');
const { Schema } = mongoose;

const SubscriptionPaymentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  plan: { type: String, enum: ['Free Trial', 'KONTRONIX', 'SOPAS', 'RTPAS'], required: true,default:"Free Trial" },
  amount: { type: Number, default:0 }, // in paise
  currency: { type: String, default: 'INR' },
  razorpayOrderId: { type: String,  },
  razorpayPaymentId: { type: String, unique: true },
  razorpaySignature: { type: String,  },
  status: { type: String, enum: ['paid'], default: 'paid' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  period: { type: String, enum: ['month', 'quarter', 'half_year', 'year'], default: 'month' },
  allowedUsers:{type:Number,default:0}
}, { timestamps: true });

const SubscriptionPayment = mongoose.model('SubscriptionPayment', SubscriptionPaymentSchema);

module.exports = { SubscriptionPayment };
