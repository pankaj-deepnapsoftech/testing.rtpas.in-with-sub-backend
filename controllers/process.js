const ProductionProcess = require("../models/productionProcess");
const BOM = require("../models/bom");
const BOMRawMaterial = require("../models/bom-raw-material");
const BOMScrapMaterial = require("../models/bom-scrap-material");
const Product = require("../models/product");
const { TryCatch, ErrorHandler } = require("../utils/error");
const BOMFinishedMaterial = require("../models/bom-finished-material");
const { DispatchModel } = require("../models/Dispatcher");
const { getAdminFilter, getAdminIdForCreation, canAccessRecord, cleanUpdateData } = require("../utils/adminFilter");

exports.create = TryCatch(async (req, res) => {
  const processData = req.body;
  if (!processData) {
    throw new ErrorHandler("Please provide all the fields", 400);
  }

  const bom = await BOM.findById(processData.bom)
    .populate({
      path: "finished_good",
      populate: { path: "item" },
    })
    .populate({
      path: "raw_materials",
      populate: [
        {
          path: "item",
        },
      ],
    })
    .populate({
      path: "scrap_materials",
      populate: [
        {
          path: "item",
        },
      ],
    });
  if (!bom) {
    throw new ErrorHandler("BOM doesn't exist", 400);
  }

  if (!bom.finished_good || !bom.finished_good.item) {
    throw new ErrorHandler("Finished good item missing in BOM", 400);
  }
  const finished_good = {
    item: bom.finished_good.item._id,
    estimated_quantity: bom.finished_good.quantity,
    remaining_quantity: bom.finished_good.quantity,
  };

  const inputProcesses = Array.isArray(processData.processes)
    ? processData.processes.filter((p) => typeof p === "string" && p.trim().length > 0)
    : [];
  const bomProcesses = Array.isArray(bom.processes)
    ? bom.processes.filter((p) => typeof p === "string" && p.trim().length > 0)
    : [];
  const selectedProcesses = inputProcesses.length > 0 ? inputProcesses : (bomProcesses.length > 0 ? bomProcesses : ["Pre-production"]);
  const processes = selectedProcesses.map((p) => ({ process: p }));

  const raw_materials = bom.raw_materials
    .filter((material) => material?.item && material.item?._id)
    .map((material) => ({
      item: material.item._id,
      estimated_quantity: material.quantity,
    }));

  const scrap_materials = bom.scrap_materials
    .filter((material) => material?.item && material.item?._id)
    .map((material) => ({
      item: material.item._id,
      estimated_quantity: material.quantity,
    }));

  // Check if user can access this BOM
  if (!canAccessRecord(req.user, bom, "admin_id")) {
    throw new ErrorHandler("You don't have permission to create production process for this BOM", 403);
  }

  const productionProcess = await ProductionProcess.create({
    ...processData,
    bom: bom._id,
    finished_good,
    processes,
    raw_materials,
    scrap_materials,
    creator: req.user._id,
    admin_id: getAdminIdForCreation(req.user),
    approved: req.user.isSuper || false,
  });

  bom.production_process = productionProcess._id;
  // bom.is_production_started = true;
  await bom.save();

  // Reset inventory approval flags for this BOM so that a fresh approval
  // request appears when a new pre-production is created for the same BOM.
  await BOMRawMaterial.updateMany(
    { bom: bom._id },
    {
      approvedByInventoryPersonnel: false,
      isInventoryApprovalClicked: false,
      isOutForInventoryClicked: false,
    }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Process has been created successfully",
  });
});
exports.update = async (req, res) => {
  const { _id, status, bom } = req.body;
  
  // Check if user can access this production process
  const productionProcess = await ProductionProcess.findById(_id);
  if (!productionProcess) {
    throw new ErrorHandler("Production Process doesn't exist", 400);
  }
  if (!canAccessRecord(req.user, productionProcess, "admin_id")) {
    throw new ErrorHandler("You don't have permission to update this production process", 403);
  }

  const bomDoc = await BOM.findById(bom._id)
    .populate({
      path: "raw_materials",
      populate: { path: "item", model: "Product" }
    })
    .populate({
      path: "scrap_materials",
      populate: { path: "item", model: "Product" }
    });



  if (!bomDoc) {
    throw new ErrorHandler("BOM not found", 404);
  }


  await Promise.all(
    bom.raw_materials.map(async (rm) => {
      // Find the BOMRawMaterial document by its _id
      const bomRawMat = await BOMRawMaterial.findById(rm._id);
      if (bomRawMat) {
        // Save in BOMRawMaterial
        bomRawMat.uom_used_quantity = rm.uom_used_quantity || bomRawMat.uom_used_quantity;
        await bomRawMat.save();

        // Save in Product (item)
        if (bomRawMat.item && rm.uom_used_quantity) {
          const product = await Product.findById(bomRawMat.item);
          if (product) {
            product.uom_used_quantity = rm.uom_used_quantity;
            await product.save();
          }
        }
      }
    })
  );

  await Promise.all(
    bom.scrap_materials.map(async (sc) => {
      // Find the BOMScrapMaterial document by its _id
      const bomSc = await BOMScrapMaterial.findById(sc._id);
      if (bomSc) {
        // Save in BOMScrapMaterial
        bomSc.uom_used_quantity = sc.uom_produced_quantity || bomSc.uom_used_quantity;
        await bomSc.save();

        // Save in Product (item)
        if (bomSc.item && sc.uom_produced_quantity) {
          const product = await Product.findById(bomSc.item);
          if (product) {
            product.uom_used_quantity = sc.uom_produced_quantity;
            await product.save();
          }
        }
      }
    })
  );

  // Get populated production process for further processing
  productionProcess = await ProductionProcess.findById(_id).populate({
    path: "scrap_materials",
    populate: { path: "item", model: "Product" }
  });
  if (!productionProcess) {
    throw new ErrorHandler("Production Process doesn't exist", 400);
  }
  if (status === "production started") {
    //new

    // FINISHED GOOD
    const prevFG = productionProcess.finished_good;
    const currFG = bom.finished_good;
    const fgProduct = await Product.findById(prevFG.item);

    if (currFG && fgProduct) {
      const prevQty = prevFG.produced_quantity || 0;
      const newQty = currFG.produced_quantity || 0;

      if (newQty > prevQty) {
        const change = newQty - prevQty;
        fgProduct.current_stock += change;
        fgProduct.change_type = "increase";
        fgProduct.quantity_changed = change;
        prevFG.produced_quantity += change;
      } else if (prevQty > newQty) {
        const change = prevQty - newQty;
        fgProduct.current_stock -= change;
        fgProduct.change_type = "decrease";
        fgProduct.quantity_changed = change;
        prevFG.produced_quantity -= change;
      }

      await fgProduct.save();
    }

    // RAW MATERIALS
    const prevRMs = productionProcess.raw_materials;
    const currRMs = bom.raw_materials;


    await Promise.all(
      prevRMs.map(async (prevRm) => {
        const rawProduct = await Product.findById(prevRm.item);
        const currRm = currRMs.find(
          (item) => item?.item + "" === prevRm?.item + ""
        );

        if (!currRm || !rawProduct) return;

        const prevQty = prevRm.used_quantity || 0;
        const newQty = currRm.used_quantity || 0;

        if (newQty > prevQty) {
          const change = newQty - prevQty;
          rawProduct.current_stock -= change;
          rawProduct.change_type = "decrease";
          rawProduct.quantity_changed = change;
          prevRm.used_quantity += change;
        } else if (prevQty > newQty) {
          const change = prevQty - newQty;
          rawProduct.current_stock += change;
          rawProduct.change_type = "increase";
          rawProduct.quantity_changed = change;
          prevRm.used_quantity -= change;
        }

        const bomRm = await BOMRawMaterial.findById(currRm._id);

        if (bomRm) {
          bomRm.in_production = true;
          bomRm.uom_used_quantity =
            currRm.uom_used_quantity || bomRm.uom_used_quantity;
          await bomRm.save();
        }

        await rawProduct.save();
      })
    );

    // SCRAP MATERIALS
    const prevSCs = productionProcess.scrap_materials;
    const currSCs = bom.scrap_materials;


    await Promise.all(
      prevSCs.map(async (prevSc) => {
        const scrapProduct = await Product.findById(prevSc.item);
        const currSc = currSCs.find(
          (item) => item?.item + "" === prevSc?.item + ""
        );

        if (!currSc || !scrapProduct) return;

        const prevQty = prevSc.produced_quantity || 0;
        const newQty = currSc.produced_quantity || 0;

        if (newQty > prevQty) {
          const change = newQty - prevQty;
          scrapProduct.current_stock -= change;
          scrapProduct.change_type = "decrease";
          scrapProduct.quantity_changed = change;
          prevSc.produced_quantity += change;
        } else if (prevQty > newQty) {
          const change = prevQty - newQty;
          scrapProduct.current_stock += change;
          scrapProduct.change_type = "increase";
          scrapProduct.quantity_changed = change;
          prevSc.produced_quantity -= change;
        }

        const bomSc = await BOMScrapMaterial.findById(currSc._id);
        if (bomSc) {
          bomSc.is_production_started = true;
          await bomSc.save();
        }

        await scrapProduct.save();
      })
    );
  }

  let hasChanges = false;

  if (Array.isArray(bom?.processes)) {
    productionProcess.processes.forEach((step) => {
      const incoming = bom.processes.find((p) => p.process === step.process);
      if (incoming) {
        const prevStart = step.start;
        const prevDone = step.done;
        const prevWorkDone = step.work_done;
        const prevWorkLeft = step.work_left;

        step.start = incoming.start ?? step.start;
        step.done = incoming.done ?? step.done;
        step.work_done = incoming.work_done ?? step.work_done;
        step.work_left = incoming.work_left ?? step.work_left;

        // Check if any process values changed
        if (
          prevStart !== step.start ||
          prevDone !== step.done ||
          prevWorkDone !== step.work_done ||
          prevWorkLeft !== step.work_left
        ) {
          hasChanges = true;
        }
      }
    });
    productionProcess.markModified("processes");
  }

  // Check if finished good quantities changed

  // console.log(
  //   "Object.keys length:",
  //   bom?.finished_good ? Object.keys(bom.finished_good).length : 0
  // );

  if (bom?.finished_good && Object.keys(bom.finished_good).length > 0) {
    const prevFG = productionProcess.finished_good;
    const currFG = bom.finished_good;

    console.log("p",prevFG)
    console.log("C", currFG)


    if (
      // currFG.produced_quantity !== undefined &&
      prevFG.produced_quantity === currFG.produced_quantity || prevFG.produced_quantity !== currFG.produced_quantity
    ) {
      // hasChanges = true;
      console.log("Finished good change detected!");
        

      productionProcess.finished_good.produced_quantity = Number(currFG.produced_quantity) || 0;


      productionProcess.finished_good.remaining_quantity =
        (Number(prevFG.remaining_quantity
        ) || 0) - (Number(currFG.produced_quantity) || 0);


      productionProcess.finished_good.final_produce_quantity += Number(currFG.produced_quantity) || 0;


    }

  }

  // Check if raw material quantities changed


  if (Array.isArray(bom?.raw_materials)) {
    bom.raw_materials.forEach((currRm, index) => {
     
      const prevRm = productionProcess.raw_materials.find(
        (item) => item?.item + "" === currRm?.item + ""
      );

      // console.log(`prevRm for ${index}:`, prevRm);
      // console.log(`currRm.used_quantity:`, currRm.used_quantity);

      // Convert used_quantity to number and check if it changed
      if (prevRm && currRm.used_quantity !== undefined) {
        const prevUsedQty = Number(prevRm.used_quantity) || 0;
        const currUsedQty = Number(currRm.used_quantity) || 0;

        // console.log(`prevUsedQty: ${prevUsedQty}, currUsedQty: ${currUsedQty}`);

        if (prevUsedQty !== currUsedQty) {
          hasChanges = true;
          console.log(`Raw material ${index} change detected!`);

       
          prevRm.used_quantity = currUsedQty;

        
          prevRm.remaining_quantity =
            (Number(prevRm.estimated_quantity) || 0) - currUsedQty;
        }

      }
    });
  }

  // Check if scrap material quantities changed
  if (Array.isArray(bom?.scrap_materials)) {
    bom.scrap_materials.forEach((currSc) => {


      // const prevSc = productionProcess.scrap_materials.find(
      //   (item) => item?.item + "" === currSc?.item + ""
      // );
      const prevSc = productionProcess.scrap_materials.find(
        (item) => {
          if (item?.item?.name === currSc?.item_name.label)
            return item;
        }
      );
      // console.log("This is prevSc::",prevSc)

      // Convert produced_quantity to number and check if it changed
      if (prevSc && currSc.produced_quantity !== undefined) {
        const prevProducedQty = Number(prevSc.produced_quantity) || 0;
        const currProducedQty = Number(currSc.produced_quantity) || 0;

        if (prevProducedQty !== currProducedQty) {
          hasChanges = true;

          // ✅ Update actual value
          prevSc.produced_quantity = currProducedQty;
        }
      }
    });
  }

  // If any changes detected and status is not "production started", set to "work in progress"


  if (hasChanges && (productionProcess.status === "production started" || productionProcess.status === "production paused" || productionProcess.status === "received")) {
    productionProcess.status = "production in progress";
  } else if (
    productionProcess.status !== "production started" &&
    typeof status === "string" &&
    status.trim() !== ""
  ) {
    productionProcess.status = status;
    // console.log("Status changed to:", status);
  } else {
    // console.log("No status change needed");
  }

  // Mark nested updates 
  productionProcess.markModified("finished_good");
  productionProcess.markModified("raw_materials");
  productionProcess.markModified("scrap_materials");
  // console.log("production process status", productionProcess);
  await productionProcess.save();



  return res.status(200).json({
    success: true,
    status: 200,
    message: "Production process updated successfully",
  });
};

exports.moveToInventory = TryCatch(async (req, res) => {
  const { processId } = req.body;

  if (!processId) throw new ErrorHandler("Process ID not provided", 400);

  // Get production process details
  const process = await ProductionProcess.findById(processId).populate(
    "finished_good.item"
  );

  if (!process) throw new ErrorHandler("Production process not found", 404);


  const product = await Product.findById(process.finished_good.item?._id);
  if (!product) throw new ErrorHandler("Product not found in inventory", 404);


  process.status = "moved to inventory";
  await process.save();

  res.status(200).json({
    success: true,
    message: `Process successfully marked as 'moved to inventory'.`,
    updatedProcess: process,
  });
  if (global.io) {
    global.io.emit("processStatusUpdated", {
      id: String(process._id),
      status: process.status,
    });
  }
});


// Out Finish Goods API
exports.outFinishGoods = async (req, res) => {
  try {
    const { id } = req.body; // frontend se ID aayegi

    if (!id) {
      return res.status(400).json({ message: "Production ID required" });
    }

    const process = await ProductionProcess.findById(id);
    if (!process) {
      return res.status(404).json({ message: "Production Process not found" });
    }

    // Current status check optional
    // Agar tum chahte ho sirf certain statuses allow ho:
    // const allowed = ["completed"];
    // if (!allowed.includes(process.status)) { return res.status(400).json({message:"Cannot mark out finished goods"}); }

    // Update status
    process.status = "Out Finished Goods"; // ya jo enum me suitable ho
    await process.save();

    res.status(200).json({ message: "Out Finished Goods marked successfully", process });
    if (global.io) {
      global.io.emit("processStatusUpdated", {
        id: String(process._id),
        status: process.status,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getInventoryProcesses = TryCatch(async (req, res) => {
  // Array of statuses jo moved to inventory ke baad aate hain
  const statuses = [
    "moved to inventory",
    "allocated finish goods",
    "Out Finished Goods",
  ];

  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);

  const processes = await ProductionProcess.find({
    $and: [
      ...(adminFilter.$and || [adminFilter]),
      { status: { $in: statuses } }
    ]
  }).populate("finished_good.item"); // agar relation hai

  res.status(200).json({
    success: true,
    data: processes,
  });
});

// controllers/process.js
exports.receiveByInventory = async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Process ID is required" });
    }

    const process = await ProductionProcess.findById(id);
    if (!process) {
      return res.status(404).json({ message: "Production process not found" });
    }

    // Step 2: Update process status


    // Step 3: Find finished good
    if (!process.finished_good) {
      return res.status(400).json({ message: "No finished good linked to this process." });
    }

    const bomFinishedMaterial = process.finished_good;

    if (!bomFinishedMaterial) {
      return res.status(404).json({ message: "Finished good material not found" });
    }

    // Step 4: Update finished product stock
    if (!bomFinishedMaterial.item) {
      return res.status(400).json({ message: "No finished product item found in BOM." });
    }

    const finishedProduct = await Product.findById(bomFinishedMaterial.item);
    if (!finishedProduct) {
      return res.status(404).json({ message: "Finished product not found" });
    }

    const quantityRaw = bomFinishedMaterial.final_produce_quantity;
    const quantityToAdd = Number(quantityRaw);
    // console.log(bomFinishedMaterial)

    if (isNaN(quantityToAdd)) {
      return res.status(400).json({ message: "Finished good quantity is invalid or missing." });
    }

    const currentStockRaw = finishedProduct.current_stock;
    const currentStock = Number(currentStockRaw) || 0;


    finishedProduct.current_stock = currentStock + quantityToAdd;
    finishedProduct.change_type = "increase";
    finishedProduct.quantity_changed = quantityToAdd;
    bomFinishedMaterial.final_produce_quantity = 0;
    bomFinishedMaterial.inventory_last_changes_quantity += Number(quantityToAdd);
    await finishedProduct.save();
    process.status = "received";
    await process.save();
    // Success
    res.status(200).json({
      message: "Finished goods received by inventory and stock updated successfully",
      process,
    });
  } catch (error) {
    console.error("Error in receiveByInventory:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};



exports.remove = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    throw new ErrorHandler("Id not provided", 400);
  }

  const productionProcess = await ProductionProcess.findById(_id);
  if (!productionProcess) {
    throw new ErrorHandler("Production process doesn't exist", 400);
  }

  await productionProcess.deleteOne();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Production process has been deleted successfully",
  });
});

exports.details = TryCatch(async (req, res) => {
  const { _id } = req.params;
  let productionProcess = await ProductionProcess.findById(_id)
    .populate("rm_store fg_store scrap_store creator item")
    .populate([
      {
        path: "finished_good",
        populate: {
          path: "item",
        },
      },
      {
        path: "raw_materials",
        populate: {
          path: "item",
          populate: {
            path: "store",
          },
        },
      },
    ])
    .populate({
      path: "bom",
      populate: [
        {
          path: "creator",
        },
        {
          path: "finished_good",
          populate: {
            path: "item",
          },
        },
        {
          path: "raw_materials",
          populate: {
            path: "item",
            populate: {
              path: "store",
            },
          },
        },
        {
          path: "scrap_materials",
          populate: {
            path: "item",
            populate: {
              path: "store",
            },
          },
        },
      ],
    });

  if (!_id) {
    throw new ErrorHandler("Production Process doesn't exist", 400);
  }
  // console.log("in backend",productionProcess)
  res.status(200).json({
    status: 200,
    success: true,
    production_process: productionProcess,
  });
});
exports.all = TryCatch(async (req, res) => {
  // Get admin filter to ensure each admin only sees their own data
  const adminFilter = getAdminFilter(req.user);

  const productionProcesses = await ProductionProcess.find(adminFilter).populate(
    "rm_store fg_store scrap_store creator item bom"
  ).sort({_id:-1});
  // console.log("prodcution proce", productionProcesses);
  res.status(200).json({
    status: 200,
    success: true,
    production_processes: productionProcesses,
  });
});

exports.requestForAllocation = TryCatch(async (req, res) => {
  const { _id } = req.query;
  // console.log("Request for allocation ID:", _id);

  if (!_id) {
    throw new ErrorHandler("ID not provided", 400);
  }
  console.log("Request for allocation for process ID:", _id);
  const process = await ProductionProcess.findById(_id);
  if (!process) {
    throw new ErrorHandler("Production process not found", 404);
  }
  // console.log("Current process status:", process);
  process.status = "request for allow inventory";
  await process.save();
  // console.log("Updated process status:", process);
  res.status(200).json({
    success: true,
    message: "Status updated to 'Request for allocation'",
    updated: process,
  });
});
exports.markInventoryInTransit = TryCatch(async (req, res) => {
  const { _id } = req.body; // Raw Material ID
  console.log(_id)
  if (!_id) {
    throw new ErrorHandler("Raw material ID is required", 400);
  }

  // 1️⃣ Update raw material
  const updatedRawMaterial = await BOMRawMaterial.findByIdAndUpdate(
    _id,
    { isOutForInventoryClicked: true }, // ✅ new field
    { new: true }
  );

  if (!updatedRawMaterial) {
    throw new ErrorHandler("Raw material not found", 404);
  }

  // 2️⃣ Get related BOM with all raw materials
  const requiredBom = await BOM.findById(updatedRawMaterial.bom)
    .populate("raw_materials");

  if (!requiredBom) {
    throw new ErrorHandler("BOM not found", 404);
  }

  // 3️⃣ Check if all raw materials are out for inventory
  const allOutForInventory = requiredBom.raw_materials.every(
    rm => rm.isOutForInventoryClicked
  );

  // 4️⃣ If all are out, update production process
  if (allOutForInventory && requiredBom.production_process) {
    await ProductionProcess.findByIdAndUpdate(
      requiredBom.production_process,
      { status: "inventory in transit" }
    );
    if (global.io) {
      global.io.emit("processStatusUpdated", {
        id: String(requiredBom.production_process),
        status: "inventory in transit",
      });
    }
  }

  res.status(200).json({
    success: true,
    message: "Raw material marked out for inventory successfully",
    rawMaterial: updatedRawMaterial,
    allOutForInventory
  });
  if (global.io) {
    global.io.emit("inventoryApprovalUpdated", {
      bomId: String(requiredBom._id),
      rawMaterialId: String(updatedRawMaterial._id),
      outForInventory: true,
    });
  }
});

exports.startProduction = async (req, res) => {
  try {
    const { _id } = req.body; // production process ID
    if (!_id) {
      return res.status(400).json({
        success: false,
        message: "Production process ID is required",
      });
    }

    // 1️⃣ Find the production process
    const process = await ProductionProcess.findById(_id);
    if (!process) {
      return res.status(404).json({
        success: false,
        message: "Production process not found",
      });
    }

    // 2️⃣ Make sure status is correct before starting
    if (process.status !== "inventory in transit") {
      return res.status(400).json({
        success: false,
        message: `Cannot start production. Current status is '${process.status}'`,
      });
    }

    // 3️⃣ Fetch the BOM linked to this process
    const bom = await BOM.findById(process.bom)
      .populate("raw_materials")
      .populate("finished_good");

    if (!bom) {
      throw new ErrorHandler("BOM not found", 404);
    }

    // 4️⃣ Mark BOM as production started
    bom.is_production_started = true;
    await bom.save();

    // 5️⃣ Deduct raw materials from stock
    await Promise.all(
      bom.raw_materials.map(async (materialId) => {
        const material = await BOMRawMaterial.findById(materialId);
        const product = await Product.findById(material.item);
        if (product) {
          product.current_stock =
            (product.current_stock || 0) - material.quantity;
          product.change_type = "decrease";
          product.quantity_changed = material.quantity;
          await product.save();
        }
      })
    );

    // 6️⃣ Add finished goods to stock
    // const finishedGoodData = await BOMFinishedMaterial.findById(bom.finished_good);
    // const finishedProduct = await Product.findById(finishedGoodData.item);
    // if (finishedProduct) {
    //   finishedProduct.current_stock =
    //     (finishedProduct.current_stock || 0) + finishedGoodData.quantity;
    //   finishedProduct.change_type = "increase";
    //   finishedProduct.quantity_changed = finishedGoodData.quantity;
    //   await finishedProduct.save();
    // }

    // 7️⃣ Update process status
    process.status = "production started";
    process.productionStartedAt = new Date();
    await process.save();

    res.status(200).json({
      success: true,
      message: "Production started successfully",
      process,
    });
    if (global.io) {
      global.io.emit("processStatusUpdated", {
        id: String(process._id),
        status: process.status,
      });
    }
  } catch (error) {
    console.error("Error in startProduction:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


exports.markDone = TryCatch(async (req, res) => {
  const { _id } = req.params;
  if (!_id) throw new ErrorHandler("Id not provided", 400);

  const productionProcess = await ProductionProcess.findById(_id)
    .populate("raw_materials.item");

  if (!productionProcess) {
    throw new ErrorHandler("Production process doesn't exist", 400);
  }

  const updatePromises = productionProcess.raw_materials.map(async (material) => {
    if (!material.item) return;

    const incQty = Number(material.remaining_quantity || 0);
    console.log("DR", incQty)
    if (incQty !== 0) {

      return Product.findByIdAndUpdate(
        material.item._id,
        {
          $inc: { current_stock: incQty },
          change_type: "increase",
          quantity_changed: incQty
        },
        { new: true }
      );
    }
  });

  await Promise.all(updatePromises);

  productionProcess.status = "completed";
  await productionProcess.save();

  res.status(200).json({
    status: 200,
    success: true,
    message: "Production process marked done & stocks updated",
  });
});



exports.updateStatus = TryCatch(async (req, res) => {
  const { _id, status } = req.body;
  if (!_id || !status) {
    throw new ErrorHandler("Status or ID not provided", 400);
  }

  const process = await ProductionProcess.findById(_id);
  if (!process) throw new ErrorHandler("Production process not found", 404);

  process.status = status;
  await process.save();

  res.status(200).json({
    success: true,
    message: `Production status updated to ${status}`,
    updated: process,
  });
  if (global.io) {
    global.io.emit("processStatusUpdated", {
      id: String(process._id),
      status: process.status,
    });
  }
});
// Pause Production
exports.pauseProduction = TryCatch(async (req, res) => {
  const { _id } = req.body; // process ID
  if (!_id) {
    throw new ErrorHandler("Process ID is required", 400);
  }

  const process = await ProductionProcess.findById(_id);
  if (!process) {
    throw new ErrorHandler("Production process not found", 404);
  }

  // ✅ Change status to paused
  process.status = "production paused";
  await process.save();

  res.status(200).json({
    success: true,
    message: "Production process paused successfully",
    updated: process,
  });
});

// controllers/process.js
exports.updateInventoryStatus = TryCatch(async (req, res) => {
  const { processId, status } = req.body;
  if (!processId || !status) {
    throw new ErrorHandler("Process ID and status are required", 400);
  }

  const allowed = ["allocated finish goods", "received"];
  if (!allowed.includes(status)) {
    throw new ErrorHandler(
      `Invalid status. Allowed: ${allowed.join(", ")}`,
      400
    );
  }

  const process = await ProductionProcess.findById(processId);
  if (!process) throw new ErrorHandler("Production process not found", 404);

  // optional: simple guard to avoid illogical reversal
  if (process.status === "received" && status === "allocated finish goods") {
    throw new ErrorHandler("Cannot move from 'received' back to 'allocated finish goods'", 400);
  }

  process.status = status;
  await process.save();

  res.status(200).json({
    success: true,
    message: `Status updated to '${status}'`,
    updatedProcess: process,
  });
  if (global.io) {
    global.io.emit("processStatusUpdated", {
      id: String(process._id),
      status: process.status,
    });
  }
});



exports.bulkDelete = TryCatch(async (req, res) => {
  const { ids } = req.body; // Expecting an array of IDs to delete
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ErrorHandler("No IDs provided for bulk delete", 400);
  }

  const result = await ProductionProcess.deleteMany({ _id: { $in: ids } });

  if (result.deletedCount === 0) {
    throw new ErrorHandler("No production processes found for the provided IDs", 404);
  }

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} production processes deleted successfully`,
  });
});

