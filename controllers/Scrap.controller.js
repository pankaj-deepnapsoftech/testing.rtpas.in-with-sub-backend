const { ScrapModel } = require("../models/Scrap.model");
const { excelToJson } = require("../utils/exceltojson");
const { assignScrapIds } = require("../utils/generateProductId");
const {
  getAdminFilter,
  getAdminIdForCreation,
} = require("../utils/adminFilter");

class ScrapMaterial {
  async createScrapMaterial(req, res) {
    try {
      const data = req.body;
      const result = await ScrapModel.create({
        ...data,
        admin_id: getAdminIdForCreation(req.user),
      });
      res.status(200).json({
        message: "Scrap Material is Created",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        message: "Scrap material not created",
      });
    }
  }

  async getScrapMaterial(req, res) {
    try {
      let { page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 10;
      const skip = (page - 1) * limit;

      const data = await ScrapModel.find(getAdminFilter(req.user))
        .skip(skip)
        .limit(limit)
        .lean();
      res.status(200).json({
        message: "Scrap Material is Created",
        data: data,
      });
    } catch (error) {
      res.status(400).json({
        message: "Scrap material not get",
      });
    }
  }

  async deleteScrapMaterial(req, res) {
    try {
      const { id } = req.params;
      const result = await ScrapModel.findOneAndDelete({
        _id: id,
        ...getAdminFilter(req.user),
      });
      if (!result) {
        return res.status(400).json({
          message: "Scrap material not found or not authorized",
        });
      }
      res.status(200).json({
        message: "Scrap material Deleted",
      });
    } catch (error) {
      res.status(400).json({
        message: "Scrap material not Deleted",
      });
    }
  }

  async updateScrapMaterial(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await ScrapModel.findOneAndUpdate(
        { _id: id, ...getAdminFilter(req.user) },
        data,
        { new: true }
      );
      if (!result) {
        return res.status(400).json({
          message: "Scrap material not found or not authorized",
        });
      }
      res.status(200).json({
        message: "Scrap material Updated",
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        message: "Scrap material not Updated",
      });
    }
  }

  async FilterScrapMaterial(req, res) {
    try {
      let { filterby, page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 10;
      const skip = (page - 1) * limit;

      if (!filterby) {
        return res
          .status(400)
          .json({ message: "Please provide filter keywords" });
      }

      const keywords = filterby.split(" ").filter((k) => k);
      const regex = new RegExp(keywords.join("|"), "i");

      const results = await ScrapModel.find({
        ...getAdminFilter(req.user),
        $or: [
          { Scrap_name: regex },
          { Scrap_id: regex },
          { Category: regex },
          { Extract_from: regex },
        ],
      })
        .skip(skip)
        .limit(limit)
        .lean();

      res.status(200).json({
        message: "Filtered scrap materials",
        data: results,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error filtering scrap materials",
        error: error.message,
      });
    }
  }

  async BulkCreateScrap(req, res) {
    try {
      const file = req.file;

      if (!file) {
        return res.status(404).json({
          message: "File not found",
        });
      }
      const data = excelToJson(file?.path);
      const dataWithId = await assignScrapIds(data);

      const adminId = getAdminIdForCreation(req.user);
      const dataWithAdminId = dataWithId.map((item) => ({
        ...item,
        admin_id: adminId,
      }));

      const result = await ScrapModel.insertMany(dataWithAdminId);
      res.status(200).json({
        message: "data Uploaded",
        datacount: result.length,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "Error filtering scrap materials",
        error: error.message,
      });
    }
  }

  async FindWithId(req, res) {
    try {
      const { id } = req.params;
      const find = await ScrapModel.findOne({
        _id: id,
        ...getAdminFilter(req.user),
      });
      if (!find) {
        return res.status(404).json({
          message: "Scrap material not found or not authorized",
        });
      }
      return res.status(200).json({
        data: find,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error get scrap materials",
        error: error.message,
      });
    }
  }
}

module.exports = { ScrapMaterial };
