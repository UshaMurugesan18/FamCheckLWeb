import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRedirect from './components/RoleRedirect';
import Login from './pages/Login';
import Home from './pages/Home';
import AddFamily from './pages/AddFamily';
import AddMember from './pages/AddMember';
import FamilyDetail from './pages/FamilyDetail';
import AssignTask from './pages/AssignTask';
import SelectGroup from './pages/SelectGroup';
import ReceiverHome from './pages/ReceiverHome';
import ReviewAssignment from './pages/ReviewAssignment';
import { seedMorningPreparation } from './api/api';

function App() {
  useEffect(() => {
    seedMorningPreparation().catch(console.error);
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* After login → role-based redirect */}
          <Route path="/redirect" element={<RoleRedirect />} />

          {/* Protected */}
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/add-family" element={<ProtectedRoute><AddFamily /></ProtectedRoute>} />
          <Route path="/add-member" element={<ProtectedRoute><AddMember /></ProtectedRoute>} />
          <Route path="/family/:familyId" element={<ProtectedRoute><FamilyDetail /></ProtectedRoute>} />
          <Route path="/family/:familyId/member/:memberId/assign" element={<ProtectedRoute><AssignTask /></ProtectedRoute>} />
          <Route path="/family/:familyId/member/:memberId/groups" element={<ProtectedRoute><SelectGroup /></ProtectedRoute>} />
          <Route path="/family/:familyId/review" element={<ProtectedRoute><ReviewAssignment /></ProtectedRoute>} />
          <Route path="/receiver/:memberId" element={<ProtectedRoute><ReceiverHome /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
