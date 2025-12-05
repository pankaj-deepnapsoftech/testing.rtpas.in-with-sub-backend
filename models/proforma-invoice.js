const { Schema, model } = require("mongoose");

const proformaInvoiceSchema = new Schema({
    creator: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Creator is a required field']
    },
    category: {
        type: String,
        enum: ['sale', 'purchase'],
        required: [true, 'category is a required field']
    },
    buyer: {
        type: Schema.Types.ObjectId,
        ref: "Parties",
    },

    supplier: {
        type: Schema.Types.ObjectId,
        ref: 'Agent'
    },
    proforma_invoice_no: {
        type: String,
        required: [true, 'Proforma invoice number is a required field']
    },
    document_date: {
        type: Date,
        default: Date.now
    },
    sales_order_date: {
        type: Date,
        default: Date.now
    },
    store: {
        type: Schema.Types.ObjectId,
        ref: "Store",
        required: [true, 'Store is a required field']
    },
    note: {
        type: String,
    },
    items: {
        type: [{
            item: {
                type: Schema.Types.ObjectId,
                ref: 'Product'
            },
            quantity: Number,
            amount: Number
        }],
        required: [true, 'Items is a required field'],
        validate: {
            validator: function(arr){
                return Array.isArray(arr) && arr.length >= 1;
            },
            message: 'Items should contain atleast 1 item'
        }
    },
    subtotal: {
        type: Number,
        required: [true, 'Subtotal is a required field']
    },
    tax:{
        type: {
            tax_amount: Number,
            tax_name: String
        },
        required: [true, 'Tax is a required field']
    },
    total: {
        type: Number,
        required: [true, 'Subtotal is a required field']
    },
    payment_mode: {
        type: String,
        enum: ['cash', 'credit', 'neft', 'upi', 'cheque', 'debit', 'other'],
        required: [true, 'Mode of payment is a required field']
    }
}, {
    timestamps: true
});

const ProformaInvoice = model("Proforma-Invoice", proformaInvoiceSchema);
module.exports = ProformaInvoice;
