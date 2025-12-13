const { Schema, model } = require("mongoose");

const productSchema = new Schema(
  {
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    inventory_category: {
      type: String,
      enum: ["direct", "indirect"],
      required: [true, "Category is a required field"],
    },
    name: {
      type: String,
      required: [true, "Product Name is a required field"],
      minlength: [2, "Product Name should be atleast 2 characters long"],
      maxlength: [40, "Product Name cannot exceed 40 characters"],
    },
    product_id: {
      type: String,
      required: [true, "Product Id is a required field"],
      index: true
    },
    uom: {
      type: String,
      required: [true, "Unit of Measurement (UoM) is a required field"],
      minlength: [
        2,
        "Unit of Measurement (UoM) should be atleast 2 characters long",
      ],
      maxlength: [40, "Unit of Measurement (UoM) cannot exceed 40 characters"],
    },
    uom_used_quantity: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      required: [true, "Product Category is a required field"],
      minlength: [2, "Inventory Type should be atleast 2 characters long"],
      maxlength: [40, "Inventory Type cannot exceed 40 characters"],
      // enum: {
      //     values: ['finished goods', 'raw materials', 'semi finished goods', 'consumables', 'bought out parts', 'trading goods', 'service'],
      //     message: 'Product Category must be one of the following: finished goods, raw materials, semi finished goods, consumables, bought out parts, trading goods, service'
      // }
    },
    current_stock: {
      type: Number,
      required: [true, "Current Stock is a required field"],
    },
    updated_stock: {
      type: Number,
      default: null,
    },
    change_type: { type: String, enum: ["increase", "decrease"] },
    quantity_changed: { type: Number },
    price: {
      type: Number,
      required: [true, "Product Price is a required field"],
    },
    latest_price: {
      type: Number,
    },
    updated_price: {
      type: Number,
      default: null,
    },
    min_stock: Number,
    max_stock: Number,
    hsn_code: String,
    approved: {
      type: Boolean,
      default: false,
    },
    color_name:{
      type:String,
    },
    item_type: {
      type: String,
      enum: ["buy", "sell", "both"],
      required: [true, "Item type is a required field"],
    },
    product_or_service: {
      type: String,
      enum: ["product", "service"],
      required: [true, "Product/Service is a required field"],
    },
    sub_category: {
      type: String,
    },
    regular_buying_price: {
      type: Number,
    },
    wholesale_buying_price: {
      type: Number,
    },
    mrp: {
      type: Number,
    },
    dealer_price: {
      type: Number,
    },
    distributor_price: {
      type: Number,
    },
    price_history: [{  // New field for price history
    price: Number,
    updated_at: { type: Date, default: Date.now }
  }],
  price_history: [{  // New field for price history
    price: Number,
    updated_at: { type: Date, default: Date.now }
  }],
    store: {
      type: Schema.Types.ObjectId,
      ref: "Store",
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to ensure all prices are whole numbers
productSchema.pre('save', function(next) {
  if (this.price !== undefined) {
    this.price = Math.round(this.price);
  }
  if (this.latest_price !== undefined) {
    this.latest_price = Math.round(this.latest_price);
  }
  if (this.updated_price !== undefined && this.updated_price !== null) {
    this.updated_price = Math.round(this.updated_price);
  }
  if (this.regular_buying_price !== undefined) {
    this.regular_buying_price = Math.round(this.regular_buying_price);
  }
  if (this.wholesale_buying_price !== undefined) {
    this.wholesale_buying_price = Math.round(this.wholesale_buying_price);
  }
  if (this.mrp !== undefined) {
    this.mrp = Math.round(this.mrp);
  }
  if (this.dealer_price !== undefined) {
    this.dealer_price = Math.round(this.dealer_price);
  }
  if (this.distributor_price !== undefined) {
    this.distributor_price = Math.round(this.distributor_price);
  }
  next();
});

// Pre-update middleware to ensure all prices are whole numbers
productSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.price !== undefined) {
    update.price = Math.round(update.price);
  }
  if (update.latest_price !== undefined) {
    update.latest_price = Math.round(update.latest_price);
  }
  if (update.updated_price !== undefined && update.updated_price !== null) {
    update.updated_price = Math.round(update.updated_price);
  }
  if (update.regular_buying_price !== undefined) {
    update.regular_buying_price = Math.round(update.regular_buying_price);
  }
  if (update.wholesale_buying_price !== undefined) {
    update.wholesale_buying_price = Math.round(update.wholesale_buying_price);
  }
  if (update.mrp !== undefined) {
    update.mrp = Math.round(update.mrp);
  }
  if (update.dealer_price !== undefined) {
    update.dealer_price = Math.round(update.dealer_price);
  }
  if (update.distributor_price !== undefined) {
    update.distributor_price = Math.round(update.distributor_price);
  }
  next();
});

// Pre-update middleware for findByIdAndUpdate
productSchema.pre('findByIdAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.price !== undefined) {
    update.price = Math.round(update.price);
  }
  if (update.latest_price !== undefined) {
    update.latest_price = Math.round(update.latest_price);
  }
  if (update.updated_price !== undefined && update.updated_price !== null) {
    update.updated_price = Math.round(update.updated_price);
  }
  if (update.regular_buying_price !== undefined) {
    update.regular_buying_price = Math.round(update.regular_buying_price);
  }
  if (update.wholesale_buying_price !== undefined) {
    update.wholesale_buying_price = Math.round(update.wholesale_buying_price);
  }
  if (update.mrp !== undefined) {
    update.mrp = Math.round(update.mrp);
  }
  if (update.dealer_price !== undefined) {
    update.dealer_price = Math.round(update.dealer_price);
  }
  if (update.distributor_price !== undefined) {
    update.distributor_price = Math.round(update.distributor_price);
  }
  next();
});

const Product = model("Product", productSchema);
productSchema.index({ admin_id: 1, product_id: 1 }, { unique: true });
module.exports = Product;
