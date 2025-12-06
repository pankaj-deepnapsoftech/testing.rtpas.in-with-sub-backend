import { Schema, model } from 'mongoose';

const SubscriptionPaymentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    plan: { type: String, enum: ['premium'], required: true },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, required: true, unique: true },
    razorpaySignature: { type: String, required: true },
    status: { type: String, enum: ['paid'], default: 'paid' },
}, { timestamps: true });

export const SubscriptionPayment = model('SubscriptionPayment', SubscriptionPaymentSchema);

