import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface CTAButtonProps {
  visible: boolean;
  sessionId: string;
  token: string;
}

type CTAStep = "button" | "form";

const INTEREST_OPTIONS = [
  { value: "investir", label: "Quero investir em imóvel" },
  { value: "proprietario", label: "Sou proprietário e quero anunciar" },
  { value: "conhecer", label: "Quero conhecer a Seazone" },
];

export default function CTAButton({ visible, sessionId, token }: CTAButtonProps) {
  const [step, setStep] = useState<CTAStep>("button");
  const [interest, setInterest] = useState("investir");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  if (!visible || submitted) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.submitCTA(sessionId, token, { interest });
      setSubmitted(true);
      navigate("/webinar/obrigado");
    } catch {
      // Still navigate even on error — the lead showed intent
      navigate("/webinar/obrigado");
    } finally {
      setLoading(false);
    }
  }

  if (step === "button") {
    return (
      <div className="p-4">
        <button
          onClick={() => setStep("form")}
          className="w-full py-4 bg-green-500 text-white font-bold text-lg rounded-2xl
            shadow-lg hover:bg-green-600 transition-colors
            animate-pulse focus:outline-none focus:ring-4 focus:ring-green-300"
        >
          Garantir minha vaga
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border-t border-green-100">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-semibold text-green-800">
          Ótimo! Qual é o seu interesse?
        </p>
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"
        >
          {INTEREST_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-500 text-white font-bold rounded-xl
            hover:bg-green-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Aguarde...
            </>
          ) : (
            "Confirmar interesse"
          )}
        </button>
      </form>
    </div>
  );
}
