const {Schema, model} = require("mongoose");

// Buyer/Supplier Model
const agentSchema = new Schema({
    agent_type: {
        type: String,
        required: [true, 'Agent Type is a required field'],
        enum: {
            // values: ['buyer', 'supplier', 'both'],
            values: ['buyer', 'supplier'],
            message: "Agent Type should be one of the following: buyer, supplier"
        }
    },
    // Contact Person Details
    name: {
        type: String,
        required: [true, "Name is a required field"],
        minlength: [2, "Name should be atleast 2 characters long"],
        maxlength: [60, "Name cannot exceed 60 characters"]
    },
    email: {
        type: String,
        required: [true, "Email is a required field"],
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
        type: String,
        required: [true, 'Phone is a required field'],
        unique: true,
        match:  [/^[7-9]\d{9}$/, 'Please provide a valid Indian mobile number']
    },
    // Company Details
    gst_number: {
        type: String
    },
    company_name: {
        type: String,
        required: [true, "Company Name is a required field"],
        minlength: [5, "Company Name should be atleast 5 characters long"],
        maxlength: [60, "Company Name cannot exceed 60 characters"]
    },
    company_email: {
        type: String,
        required: [true, "Company Email is a required field"],
        unique: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid company email address']
    },
    company_phone: {
        type: String,
        required: [true, 'Company phone is a required field'],
        unique: true,
        match:  [/^[7-9]\d{9}$/, 'Please provide a valid Indian company mobile number']
    },
    address_line1: {
        type: String,
        required: [true, 'Address Line 1 is a required field'],
        minlength: [10, "Address Line 1 should be atleast 10 characters long"],
        maxlength: [500, "Address Line 1 cannot exceed 500 characters"]
    },
    address_line2: {
        type: String,
        maxlength: [500, "Address Line 2 cannot exceed 500 characters"]
    },
    pincode: {
        type: Number,
        match: [/^[1-9][0-9]{5}$/, 'Please provide a valid pincode']
    },
    city: {
        type: String,
        required: [true, 'City is a required field'],
        minlength: [2, "City should be atleast 10 characters long"],
        maxlength: [100, "City cannot exceed 500 characters"]
    },
    state: {
        type: String,
        required: [true, 'State is a required field'],
        minlength: [2, "State should be atleast 10 characters long"],
        maxlength: [100, "State cannot exceed 500 characters"]
    },
    approved: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Agent = model("Agent", agentSchema);
module.exports = Agent;