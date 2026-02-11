import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Gallery from './pages/Gallery.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
    return (
        <>
            <Routes>
                <Route
                    path="/"
                    element={
                        <>
                            <Navbar />
                            <Home />
                            <Footer />
                        </>
                    }
                />
                <Route
                    path="/gallery"
                    element={
                        <>
                            <Navbar />
                            <Gallery />
                            <Footer />
                        </>
                    }
                />
                <Route path="/admin" element={<Admin />} />
            </Routes>
        </>
    );
}
