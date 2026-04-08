import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Gallery from './pages/Gallery.jsx';
import Schedule from './pages/Schedule.jsx';
import Admin from './pages/Admin.jsx';
import Attendance from './pages/Attendance.jsx';
import ResetPassword from './pages/ResetPassword.jsx';

export default function App() {
    useEffect(() => {
        AOS.init({
            duration: 800, // Default animation duration
            once: true, // Whether animation should happen only once - while scrolling down
            offset: 100, // Offset (in px) from the original trigger point
        });
    }, []);

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
                <Route
                    path="/schedule"
                    element={
                        <>
                            <Navbar />
                            <Schedule />
                            <Footer />
                        </>
                    }
                />
                <Route path="/admin" element={<Admin />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/attendance" element={<Attendance />} />
            </Routes>
        </>
    );
}
