

exports.Validater = (schema)=>{
    return   async (req,res,next) => {
        try {
            const data = req.body;
            const validate = await schema.validateSync(data, { abortEarly: false });
            next();
        }catch(err){
            if (err.inner) {
                const errors = err.inner.map(e => ({
                  path: e.path,
                  message: e.message,
                }));
               return   res.status(400).json({errors});
              } else {
                console.error("Unexpected error:", err);
              }
        }
    }
}