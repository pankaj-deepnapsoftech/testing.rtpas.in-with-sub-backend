const { ScrapModel } = require("../models/Scrap.model");
const { excelToJson } = require("../utils/exceltojson");
const { assignScrapIds } = require("../utils/generateProductId");



class ScrapMaterial {


    async createScrapMaterial(req, res) {
        try {
            const data = req.body;
            const result = await ScrapModel.create(data);
            res.status(200).json({
                message: "Scrap Material is Created",
                data: result
            })
        } catch (error) {
            res.status(400).json({
                message: "Scrap material not created"
            })
        }

    };

    async getScrapMaterial(req, res) {
        try {
            let { page, limit } = req.query;
            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;

            const data = await ScrapModel.find({}).skip(skip).limit(limit).lean();
            res.status(200).json({
                message: "Scrap Material is Created",
                data: data
            })
        } catch (error) {
            res.status(400).json({
                message: "Scrap material not get"
            })
        }

    };

    async deleteScrapMaterial(req, res) {
        try {
            const { id } = req.params;
            const result = await ScrapModel.findByIdAndDelete(id);
            if (!result) {
                res.status(400).json({
                    message: "Scrap material not Deleted"
                })
            }
            res.status(200).json({
                message: "Scrap material Deleted"
            })
        } catch (error) {
            res.status(400).json({
                message: "Scrap material not Deleted"
            })
        }
    };

    async updateScrapMaterial(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const result = await ScrapModel.findByIdAndUpdate(id, data);
            if (!result) {
                res.status(400).json({
                    message: "Scrap material not Updated"
                })
            }
            res.status(200).json({
                message: "Scrap material Updated"
            })

        } catch (error) {
            res.status(400).json({
                message: "Scrap material not Updated"
            })
        }
    };

    async FilterScrapMaterial(req, res) {
        try {

            const { filterby,page, limit } = req.query;
            page = parseInt(page) || 1;
            limit = parseInt(limit) || 10;
            const skip = (page - 1) * limit;


            if (!filterby) {
                return res.status(400).json({ message: "Please provide filter keywords" });
            }

            const keywords = filterby.split(" ").filter(k => k);
            const regex = new RegExp(keywords.join("|"), "i"); // ✅ fixed

            const results = await ScrapModel.find({
                $or: [
                    { Scrap_name: regex },
                    { Scrap_id: regex },
                    { Category: regex },
                    { Extract_from: regex }
                ]
            }).skip(skip).limit(limit).lean();

            res.status(200).json({
                message: "Filtered scrap materials",
                data: results
            });

        } catch (error) {
            console.error(error); // log error
            res.status(500).json({
                message: "Error filtering scrap materials",
                error: error.message
            });
        }
    };

    async BulkCreateScrap(req, res) {
        try {
            const file = req.file;

            if (!file) {
                return res.status(404).json({
                    message: "File not found",
                })
            }
            const data = excelToJson(file?.path);
            const dataWithId = await assignScrapIds(data)
            const result = await ScrapModel.insertMany(dataWithId);
            res.status(200).json({
                message: "data Uploaded",
                datacount:result.length
            })
        } catch (error) {
            console.log(error)
            res.status(500).json({
                message: "Error filtering scrap materials",
                error: error.message
            });
        }
    };

    async FindWithId(req,res){

       try {
         const {id} = req.params;
         const find = await ScrapModel.findById(id);
         return res.status(200).json({
            data:find
         })
       } catch (error) {
         console.error(error); // log error
            res.status(500).json({
                message: "Error get scrap materials",
                error: error.message
            });
       }

    }

}

module.exports = { ScrapMaterial }