const Agent = require("../models/agent");
const fs = require('fs');
const csv = require('csvtojson');
const { TryCatch, ErrorHandler } = require("../utils/error");
const { checkAgentCsvValidity } = require("../utils/checkAgentCsvValidity");
const { PartiesModels } = require("../models/Parties");

exports.create = TryCatch(async (req, res) => {
  const agentDetails = req.body;
  if (!agentDetails) {
    throw new ErrorHandler("Please provide the agent details", 400);
  }

  const isAdmin = !!req.user?.isSuper;
  const agent = await Agent.create({ ...agentDetails, approved: isAdmin });

  if (isAdmin) {
    const parties_type = agent.agent_type === "supplier" ? "Seller" : "Buyer";
    const type = "Company";
    const company_name = agent.company_name || "";
    const consignee_name = [agent.name].filter(Boolean);
    const contact_number = [agent.company_phone, agent.phone].filter(Boolean);
    const email_id = [agent.company_email, agent.email].filter(Boolean);
    const bill_to = agent.address_line1 || "";
    const shipped_to = agent.address_line1 || "";
    const bill_gst_to = agent.gst_number || "";
    const shipped_gst_to = agent.gst_number || "";

    const prefix = (type === "Company" && company_name
      ? company_name.trim().substring(0, 2).toUpperCase()
      : (consignee_name[0] || "CU").trim().substring(0, 2).toUpperCase());
    const lastParty = await PartiesModels.findOne({ cust_id: { $regex: `^${prefix}` } }).sort({ createdAt: -1 });
    let nextId = 1;
    if (lastParty) {
      const lastId = lastParty.cust_id.replace(prefix, "");
      nextId = Number(lastId) + 1;
    }
    const cust_id = `${prefix}${nextId.toString().padStart(3, "0")}`;

    const exists = await PartiesModels.findOne({ company_name, parties_type });
    if (!exists) {
      await PartiesModels.create({
        cust_id,
        consignee_name,
        contact_number,
        email_id,
        shipped_to,
        bill_to,
        shipped_gst_to,
        bill_gst_to,
        type,
        company_name,
        parties_type,
        contact_person_name: agent.name || "",
      });
    }
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: "Agent has been added successfully",
    agent,
  });
});
exports.update = TryCatch(async (req, res) => {
  const { id } = req.params;
  const agentDetails = req.body;
  if (!id) {
    throw new ErrorHandler("Agent Id not provided", 400);
  }
  if (!agentDetails) {
    throw new ErrorHandler("Please provide the agent details", 400);
  }
  let existing = await Agent.findById(id);
  if (!existing) {
    throw new ErrorHandler("Agent doesn't exist", 400);
  }

  const wasApproved = !!existing.approved;
  const willBeApproved = agentDetails.approved === true;

  const agent = await Agent.findByIdAndUpdate(id, { ...agentDetails }, { new: true });

  if (!wasApproved && willBeApproved) {
    const parties_type = agent.agent_type === "supplier" ? "Seller" : "Buyer";
    const type = "Company";
    const company_name = agent.company_name || "";
    const consignee_name = [agent.name].filter(Boolean);
    const contact_number = [agent.company_phone, agent.phone].filter(Boolean);
    const email_id = [agent.company_email, agent.email].filter(Boolean);
    const bill_to = agent.address_line1 || "";
    const shipped_to = agent.address_line1 || "";
    const bill_gst_to = agent.gst_number || "";
    const shipped_gst_to = agent.gst_number || "";

    const prefix = (type === "Company" && company_name
      ? company_name.trim().substring(0, 2).toUpperCase()
      : (consignee_name[0] || "CU").trim().substring(0, 2).toUpperCase());
    const lastParty = await PartiesModels.findOne({ cust_id: { $regex: `^${prefix}` } }).sort({ createdAt: -1 });
    let nextId = 1;
    if (lastParty) {
      const lastId = lastParty.cust_id.replace(prefix, "");
      nextId = Number(lastId) + 1;
    }
    const cust_id = `${prefix}${nextId.toString().padStart(3, "0")}`;

    const exists = await PartiesModels.findOne({ company_name, parties_type });
    if (!exists) {
      await PartiesModels.create({
        cust_id,
        consignee_name,
        contact_number,
        email_id,
        shipped_to,
        bill_to,
        shipped_gst_to,
        bill_gst_to,
        type,
        company_name,
        parties_type,
        contact_person_name: agent.name || "",
      });
    }
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: "Agent details has been updated successfully",
    agent,
  });
});
exports.remove = TryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorHandler("Agent Id not provided", 400);
  }
  let agent = await Agent.findById(id);
  if (!agent) {
    throw new ErrorHandler("Agent doesn't exist", 400);
  }
  await agent.deleteOne();
  res.status(200).json({
    status: 200,
    success: true,
    message: "Agent has been deleted successfully",
    agent,
  });
});
exports.details = TryCatch(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ErrorHandler("Agent Id not provided", 400);
  }
  let agent = await Agent.findById(id);
  if (!agent) {
    throw new ErrorHandler("Agent doesn't exist", 400);
  }
  res.status(200).json({
    status: 200,
    success: true,
    agent,
  });
});
exports.allBuyers = TryCatch(async (req, res) => {
  const agents = await Agent.find({ agent_type: "buyer", approved: true });
  res.status(200).json({
    status: 200,
    success: true,
    agents,
  });
});
exports.allSuppliers = TryCatch(async (req, res) => {
  const agents = await PartiesModels.find(
    { parties_type: "Seller" },
    { _id: 1, consignee_name: 1 }
  );

  const formatted = agents.map(agent => ({
    id: agent._id,
    name: Array.isArray(agent.consignee_name) ? agent.consignee_name[0] : agent.consignee_name
  }));

  res.status(200).json({
    status: 200,
    success: true,
    agents: formatted,
  });
});




exports.unapprovedBuyers = TryCatch(async (req, res) => {
  const agents = await Agent.find({ agent_type: "buyer", approved: false });
  res.status(200).json({
    status: 200,
    success: true,
    agents,
  });
});
exports.unapprovedSuppliers = TryCatch(async (req, res) => {
  const agents = await Agent.find({ agent_type: "supplier", approved: false });
  res.status(200).json({
    status: 200,
    success: true,
    agents,
  });
});
exports.bulkUploadHandler = async (req, res) => {
  csv()
    .fromFile(req.file.path)
    .then(async (response) => {
      try {
        fs.unlink(req.file.path, () => {});

        await checkAgentCsvValidity(response);

        const stores = response;

        await Agent.insertMany(stores);

        res.status(200).json({
          status: 200,
          success: true,
          message: "Merchants has been added successfully",
        });
      } catch (error) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: error?.message,
        });
      }
    });
};
