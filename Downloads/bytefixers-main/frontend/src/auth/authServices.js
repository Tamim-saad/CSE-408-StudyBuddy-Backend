import axios from "axios";
import { appConfig } from "../common/config";

const saveAuthUser = (authUser) =>
  localStorage.setItem(appConfig.CURRENT_USER_KEY, JSON.stringify(authUser));

export const getAuthUser = () =>
  JSON.parse(localStorage.getItem(appConfig.CURRENT_USER_KEY));

export const isUserLoggedIn = () => Boolean(getAuthUser());

export const getAccessToken = () => getAuthUser()?.accessToken;

export const getRefreshToken = () => getAuthUser()?.refreshToken;

console.log(appConfig.BASE_URL);
export const signup = ({ name, email, password, projectId }) =>
  axios.post(`${process.env.REACT_APP_BASE_URL}/api/user/sign-up`, {
    name,
    email,
    password,
    projectId,
  });

export const login = async ({ type, email, password, refreshToken }) => {
  console.log("Login data", { type, email, password, refreshToken });
  const authUser = (
    await axios.post(`${process.env.REACT_APP_BASE_URL}/api/user/login`, {
      type,
      email,
      password,
      refreshToken,
    })
  ).data;
  console.log("✅ Login Successful:", authUser.data);
  saveAuthUser(authUser);
  return authUser;
};
export const loginWithGoogle = async (googlePayload) => {
  try {
    const response = await axios.post(
      `${process.env.REACT_APP_BASE_URL}/auth/google-login`,
      googlePayload
    );
    console.log("Google login response:", response.data);
    saveAuthUser(response.data);
    return response.data;
  } catch (error) {
    console.error("Google login error:", error);
    throw error;
  }
};
export const logout = () => {
  localStorage.removeItem(appConfig.CURRENT_USER_KEY);
};
export const addUserToProject = (userId, projectId) => {
  return axios
    .post(`${process.env.REACT_APP_BASE_URL}/projects/addUserToProject`, {
      userId,
      projectId,
    })
    .then((response) => {
      console.log("User added to project successfully:", response.data);
      return response.data; // Return the response or any necessary data
    })
    .catch((error) => {
      console.error("Error adding user to project:", error);
      throw error; // You can choose to handle the error or rethrow it
    });
};
