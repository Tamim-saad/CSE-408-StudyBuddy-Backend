import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { LoginForm, SignupForm } from "../components/auth";
import AppBar from "../components/appbar/AppBar";
import Sidebar from "../components/Board/sidebar/sidebar";
import { Dashboard } from "../components/project";
import { UserProfile } from "../components/auth/UserProfile";
import propTypes from "prop-types";
const KanbanLayout = () => {
  return (
    <div className="kanban-layout flex">
      <Sidebar />
      <Outlet />
      {/* This is where the nested route (ProjectCreate) will render */}
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppBar />,
    children: [],
  },
  {
    path: "/signup",
    element: <SignupForm />,
  },
  {
    path: "/login",
    element: <LoginForm />,
  },
  {
    path: "/home",
    element: <KanbanLayout />,
    children: [
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "profile",
        element: <UserProfile />,
      },

    ],
  },
]);
export const AppRouter = ({ children }) => {
  return <RouterProvider router={router}>{children}</RouterProvider>;
};
AppRouter.propTypes = {
  children: propTypes.node,
};
