exports.globalErrorHandler = (err, req, res, next)=>{
    err.message ||= "Internal Server Error";
    err.statusCode ||= 500

    if (err.name === 'ValidationError') {
        const errorMessages = Object.values(err.errors).map(err => err.message);
        const errorMessage = errorMessages.join(', ');
        return res.status(400).json({
            status: 400,
            success: false,
            message: errorMessage
        });
    }
    else if(err.name === "MongoServerError" && err.code === 11000){
        let message = '';
        const kv = err.keyValue || {};
        const dupField = Object.keys(kv)[0];
        if(err.message.includes('email')){
            message = err.message;
        } 
        else if(err.message.includes('phone')){
            message = "Phone No. is already registered";
        }
        else if(err.message.includes('product_id')){
            message = "Product Id is already used";
        }
        else if(err.message.includes('company_email')){
            message = "Company Email Id is already registered";
        }
        else if(err.message.includes('company_phone')){
            message = "Company Phone No. is already registered";
        }
        else if(err.message.includes('role')){
            message = "Role is already created";
        }
        else if(err.message.includes('razorpayOrderId')){
            message = "Payment order already exists";
        }
        else if(err.message.includes('razorpayPaymentId')){
            message = "Payment has been recorded already";
        }
        else if(err.message.includes('employeeId')){
            message = "Employee ID already exists";
        }
        else if(err.message.includes('cust_id')){
            message = "Customer ID already exists";
        }
        else if(dupField){
            message = `${dupField} is already registered`;
        }
        else{
            message = "A unique constraint error occurred";
        }

        return res.status(400).json({
            status: 400,
            success: false,
            message: message
        });
    }
    else if(err.name === "JsonWebTokenError"){
        let message = '';

        if(err.message.includes('jwt malformed')){
            message = "Session expired, Login again to continue";
        }
        else{
            message = "Invalid token";
        }

        return res.status(401).json({
            status: 401,
            success: false,
            message: message
        });
    }

    return res.status(err.statusCode).json({
        status: err.statusCode,
        success: false,
        message: err.message
    })
}
