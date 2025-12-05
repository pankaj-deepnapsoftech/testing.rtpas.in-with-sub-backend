const { Schema, model } = require("mongoose");

const invoiceSchema = new Schema(
  {
    creator: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is a required field"],
    },

    // Basic Invoice Info
    invoiceNo: {
      type: String,
      required: [true, "Invoice number is required"],
    },

    // Consignee (Ship To) Information
    consigneeShipTo: {
      type: String,
      required: [true, "Consignee ship to is required"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
    },
    gstin: {
      type: String,
    },

    // Biller (Bill To) Information
    billerAddress: {
      type: String,
      required: [true, "Biller address is required"],
    },
    billerGSTIN: {
      type: String,
    },

    // Invoice Details
    deliveryNote: {
      type: String,
    },
    modeTermsOfPayment: {
      type: String,
      required: [true, "Mode/Terms of payment is required"],
    },
    referenceNo: {
      type: String,
    },
    otherReferences: {
      type: String,
    },
    buyersOrderNo: {
      type: String,
      required: [true, "Buyer's order no is required"],
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    dispatchDocNo: {
      type: String,
    },
    deliveryNoteDate: {
      type: Date,
    },
    dispatchedThrough: {
      type: String,
    },
    destination: {
      type: String,
    },

    // Additional Terms
    termsOfDelivery: {
      type: String,
    },
    remarks: {
      type: String,
    },

    // Legacy fields (keeping for backward compatibility)
    category: {
      type: String,
      enum: ["sale", "purchase"],
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Parties",
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
    },
    invoice_no: {
      type: String,
    },
    document_date: {
      type: Date,
      default: Date.now,
    },
    sales_order_date: {
      type: Date,
      default: Date.now,
    },
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
    },
    note: {
      type: String,
    },
    items: {
      type: [
        {
          item: {
            type: Schema.Types.ObjectId,
            ref: "Product",
          },
          quantity: Number,
          amount: Number,
        },
      ],
    },
    subtotal: {
      type: Number,
    },
    tax: {
      type: {
        tax_amount: Number,
        tax_name: String,
      },
    },
    total: {
      type: Number,
    },
    balance: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

const Invoice = model("Invoice", invoiceSchema);
module.exports = Invoice;
