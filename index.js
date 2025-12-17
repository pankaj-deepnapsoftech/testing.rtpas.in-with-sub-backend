const express = require("express");
const cors = require("cors");
const socketIo = require('socket.io');
const http = require('http');
const {DeviceData} = require('./models/deviceData'); // Import DeviceData model

const { globalErrorHandler } = require("./middlewares/error");
const { connectDB } = require("./utils/connectDB");

const authRoutes = require("./routes/user");
const productRoutes = require("./routes/product");
const storeRoutes = require("./routes/store");
const agentRoutes = require("./routes/agent");
const userRoleRoutes = require("./routes/userRole");
const bomRoutes = require("./routes/bom");
const dashboardRoutes = require("./routes/dashboard");
const proformaInvoiceRoutes = require("./routes/proformaInvoice");
const invoiceRoutes = require("./routes/invoice");
const productionProcessRoutes = require("./routes/productionProcess");
const paymentRoutes = require("./routes/payment");
const scrapRoutes = require("./routes/scrap");
const salesRoutes = require("./routes/sales");
const AssinedRoutes = require("./routes/Assined.routes");
const PartiesRoutes = require("./routes/Parties");
const DispatchRoute = require("./routes/Dispatch.routes");
const PurchaseOrderRoutes = require("./routes/PurchaseOrder");
const ResourceRoutes = require("./routes/resources");
const DeviceDataRoutes = require('./routes/deviceData.routes');
const {ScrapRoutes} = require("./routes/Scrap.routes");
const subscriptionRoutes = require("./routes/subscription");
const contactRoutes = require("./routes/contact");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "https://inventory.deepmart.shop",
      "https://sopasb2b.deepmart.shop",
      "https://testing.rtpas.in",
      "https://subscriptiontest.rtpas.in",
      "https://subscription.rtpas.in",
      
    ],
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  },
});
global.io = io;

// Load environment variables
require('dotenv').config();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://inventory.deepmart.shop",
  "https://sopasb2b.deepmart.shop",
  "https://rtpas.deepnapsoftech.com",
  "https://testing.rtpas.in",
  "https://subscriptiontest.rtpas.in",
  "https://subscription.rtpas.in",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Authorization,Content-Type",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);

  // NodeMCU joins the "nodemcu" room
  socket.on("joinNodeMCU", () => {
    socket.join("nodemcu");
    console.log("NodeMCU joined room: nodemcu");
  });

  // Frontend dashboard joins the "dashboard" room
  socket.on("joinDashboard", () => {
    socket.join("dashboard");
    console.log("Frontend joined room: dashboard");
  });

  // Handle deviceData from NodeMCU
  socket.on("deviceData", async (data) => {
    console.log("Received deviceData from NodeMCU:", data);
    try {
      const {
        temperature,
        humidity,
        gasLevel,
        ldrRaw,
        encoderCount,
        encoderA,
        encoderB,
        motorRPM,
        breakcount
      } = data;

      console.log("Dta from node mcu : ",data)

      const query = {};
      // Fetch current document to get breakCount
      const currentData = await DeviceData.findOne(query);
      // let breakCount = currentData ? currentData.breakCount || 0 : 0;
      // Increment breakCount if ldrRaw == 1
      // if (ldrRaw === 1) {
      //   breakCount++;
        // console.log(`ldrRaw = 1, breakCount incremented to ${breakCount}`);
      // }

      const updatedOrCreated = await DeviceData.findOneAndUpdate(
        query,
        {
          $set: {
            temperature,
            humidity,
            gasLevel,
            ldrRaw,
            encoderCount,
            encoderA,
            encoderB,
            motorRPM,
            breakCount: breakcount,// Save updated breakCount
          },
        },
        { new: true, upsert: true }
      );

      // Emit sensor data to dashboard with all sensor values
      io.to("dashboard").emit("controlDataUpdate", {
        temperature,
        humidity,
        gasLevel,
        ldrRaw,
        encoderCount,
        encoderA,
        encoderB,
        motorRPM,
        breakCount: breakcount,
        // Include any existing control states from database
        lightState: updatedOrCreated.lightState,
        fanState: updatedOrCreated.fanState,
        motorState: updatedOrCreated.motorState,
        rgbState: updatedOrCreated.rgbState,
        rgbRed: updatedOrCreated.rgbRed,
        rgbGreen: updatedOrCreated.rgbGreen,
        rgbBlue: updatedOrCreated.rgbBlue,
      });

      console.log("Device data saved and emitted to dashboard");
    } catch (err) {
      console.error("Error saving deviceData:", err);
    }
  });

  // Handle control updates from frontend (unchanged)
  socket.on("controlUpdate", (data) => {
    console.log("Received controlUpdate:", data);
    io.to("nodemcu").emit("controlData", data);
    io.to("dashboard").emit("controlDataUpdate", data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/product", productRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/role", userRoleRoutes);
app.use("/api/bom", bomRoutes);
app.use('/api/devicedata', DeviceDataRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/proforma-invoice", proformaInvoiceRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/production-process", productionProcessRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/scrap", scrapRoutes);
app.use("/api/sale", salesRoutes);
app.use("/api/assined", AssinedRoutes);
app.use("/api/parties", PartiesRoutes);
app.use('/api/dispatch', DispatchRoute);
app.use('/api/purchase-order', PurchaseOrderRoutes);
app.use("/api/resources", ResourceRoutes);
app.use("/api/scrap", ScrapRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/contact", contactRoutes);
app.use(globalErrorHandler);

server.listen(process.env.PORT, '0.0.0.0', () => {
  console.log(`Server is listening on Port: ${process.env.PORT}`);
  connectDB();
});
