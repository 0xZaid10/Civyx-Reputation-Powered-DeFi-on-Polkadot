import { Routes, Route } from 'react-router-dom';
import { Navbar }      from '@/components/Navbar';
import Landing         from '@/pages/Landing';
import Register        from '@/pages/Register';
import Dashboard       from '@/pages/Dashboard';
import LinkWallet      from '@/pages/LinkWallet';
import Developers      from '@/pages/Developers';
import XCMDemo         from '@/pages/XCMDemo';
import CivUSDPage      from '@/pages/CivUSDPage';
import ExternalTasksPage from '@/pages/ExternalTasksPage';
import CommunityPage   from '@/pages/CommunityPage';

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Routes>
        <Route path="/"             element={<Landing />} />
        <Route path="/app"          element={<Dashboard />} />
        <Route path="/app/register" element={<Register />} />
        <Route path="/app/link"     element={<LinkWallet />} />
        <Route path="/developers"   element={<Developers />} />
        <Route path="/xcm-demo"      element={<XCMDemo />} />
        <Route path="/civusd"         element={<CivUSDPage />} />
        <Route path="/earn"           element={<ExternalTasksPage />} />
        <Route path="/community"      element={<CommunityPage />} />
      </Routes>
    </div>
  );
}
