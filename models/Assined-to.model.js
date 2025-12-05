const {Schema,model,} = require("mongoose");


const AssinedSchema = new Schema({
    sale_id:{type:Schema.Types.ObjectId,ref:"purchase",required:true},
    assined_to:{type:Schema.Types.ObjectId,ref:"User",required:true},
    assined_by:{type:Schema.Types.ObjectId,ref:"User",required:true},
    assined_process:{type:String,required:true,trim:true,lowercase:true},
    isCompleted:{type:String,reqtured:true,default:"Pending",enum:["Pending", "UnderProcessing","Complete"]},
    assinedby_comment:{type:String,trim:true},
    assinedto_comment:{type:String,trim:true},
},{timestamps:true})

exports.AssinedModel = model("assined",AssinedSchema); 