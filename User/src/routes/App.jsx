import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import json from "./Routes.json";

import Home from "../App/home/pages/Home";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={json.start} element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
