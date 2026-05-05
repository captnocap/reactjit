import { createContext, useContext, useState } from 'react';

export const TOTAL_STEPS = 5;

const Ctx = createContext({
  step: 0,
  totalSteps: TOTAL_STEPS,
  complete: false,
  loading: false,
  setStep: () => {},
  markComplete: () => {},
  shouldPlayFirstStartAnimation: false,
  markFirstStartAnimationPlayed: () => {},
  homeEntryPlayed: false,
  markHomeEntryPlayed: () => {},
  tourStatus: null,
  acceptTour: () => {},
  declineTour: () => {},
  name: '',
  setName: () => {},
  providerKind: null,
  setProviderKind: () => {},
  traits: [],
  setTraits: () => {},
  configPath: '',
  setConfigPath: () => {},
  goal: '',
  setGoal: () => {},
});

// Onboarding is iteration-only right now: nothing persists until the full
// flow is locked in. Every fresh boot starts at step 0 with a clean record.
// When we lock in, swap this back to a useCRUD-backed store and migrate the
// shape into User.onboarding (see cart/component-gallery/data/user.ts).
export function OnboardingProvider({ children }) {
  const [step, setStepState] = useState(0);
  const [complete, setComplete] = useState(false);
  const [name, setNameState] = useState('');
  const [providerKind, setProviderKindState] = useState(null);
  const [traits, setTraitsState] = useState([]);
  const [configPath, setConfigPathState] = useState('');
  const [goal, setGoalState] = useState('');
  const [animationPlayedThisSession, setAnimationPlayedThisSession] = useState(false);
  const [homeEntryPlayed, setHomeEntryPlayed] = useState(false);
  // tourStatus: null (not offered) | 'pending' (banner showing) | 'accepted' | 'declined'
  const [tourStatus, setTourStatusState] = useState(null);

  const setStep = (next) => {
    const clamped = Math.max(0, Math.min(TOTAL_STEPS - 1, next));
    if (clamped > step) setAnimationPlayedThisSession(true);
    setStepState(clamped);
  };

  const setName = (next) => {
    setNameState(typeof next === 'string' ? next : '');
  };

  const setProviderKind = (kind) => {
    setProviderKindState(kind);
  };

  const setTraits = (next) => {
    setTraitsState(Array.isArray(next) ? next : []);
  };

  const setConfigPath = (next) => {
    setConfigPathState(typeof next === 'string' ? next : '');
  };

  const setGoal = (next) => {
    setGoalState(typeof next === 'string' ? next : '');
  };

  // Completing onboarding offers the tour banner. Returning users (already
  // complete from disk, when persistence is wired) won't re-trigger the
  // banner because tourStatus stays whatever it last was.
  const markComplete = () => {
    setComplete(true);
    setTourStatusState((prev) => prev == null ? 'pending' : prev);
  };

  const markFirstStartAnimationPlayed = () => {
    setAnimationPlayedThisSession(true);
  };

  const markHomeEntryPlayed = () => {
    setHomeEntryPlayed(true);
  };

  const acceptTour = () => {
    setTourStatusState('accepted');
  };

  const declineTour = () => {
    setTourStatusState('declined');
  };

  const value = {
    step,
    totalSteps: TOTAL_STEPS,
    complete,
    loading: false,
    setStep,
    markComplete,
    shouldPlayFirstStartAnimation: !complete && step === 0 && !animationPlayedThisSession,
    markFirstStartAnimationPlayed,
    homeEntryPlayed,
    markHomeEntryPlayed,
    tourStatus,
    acceptTour,
    declineTour,
    name,
    setName,
    providerKind,
    setProviderKind,
    traits,
    setTraits,
    configPath,
    setConfigPath,
    goal,
    setGoal,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  return useContext(Ctx);
}
