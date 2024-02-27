import app from "./app";
import { ENV } from "./constants";

const port = ENV.port;
app.listen(port, () => console.log(" server is running on port", port));
