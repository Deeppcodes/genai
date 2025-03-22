import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ScanProduct from './pages/ScanProduct';
import Profile from './pages/Profile';
import Search from './pages/Search';
import Product from './pages/Product';

const AppContent = () => {
  const location = useLocation();
  const showNavbar = location.pathname !== '/scan';
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <div className="App">
      {showNavbar && <Navbar />}
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/scan" element={<ScanProduct />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/search" element={
            <Search onProductSelect={setSelectedProduct} />
          } />
          <Route path="/product" element={
            <Product product={selectedProduct} />
          } />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

