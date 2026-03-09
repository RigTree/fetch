import { create } from "zustand";
import { persist } from "zustand/middleware";

const useStore = create(
  persist(
    (set) => ({
      profileData: null,
      hardwareScan: null,
      currentStep: "scan",
      sessionEndpoint: null,
      sessionType: null,

      setProfileData: (data) => set({ profileData: data }),
      setHardwareScan: (data) => set({ hardwareScan: data }),
      setStep: (step) => set({ currentStep: step }),
      setSession: (endpoint, type = "computer") =>
        set({ sessionEndpoint: endpoint, sessionType: type || "computer" }),
    }),
    {
      name: "rigtree-fetch-store",
      partialize: (state) => ({
        profileData: state.profileData,
      }),
    }
  )
);

export default useStore;
