"use client";

import { useState } from "react";
import { Mail, X, ChevronDown, Check } from "lucide-react";

export interface EmailOption {
  email: string;
  label?: string;
  isPrimary?: boolean;
}

interface EmailPickerModalProps {
  /** Liste des adresses disponibles (principale + secondaires) */
  options: EmailOption[];
  /** Adresse présélectionnée (email principal de la commande) */
  defaultEmail: string;
  /** Libellé du bouton d'action (ex. "Envoyer la facture") */
  actionLabel: string;
  /** Callback appelé avec l'adresse choisie */
  onConfirm: (email: string) => void;
  /** Callback annulation */
  onCancel: () => void;
}

/**
 * Modal de sélection d'adresse email destinataire.
 * S'affiche uniquement quand le client a plusieurs adresses enregistrées.
 */
export function EmailPickerModal({ options, defaultEmail, actionLabel, onConfirm, onCancel }: EmailPickerModalProps) {
  const [selected, setSelected] = useState<string>(defaultEmail);

  // Dédupliquer les options (au cas où l'email principal apparaît aussi dans les secondaires)
  const deduped = Array.from(new Map(options.map((o) => [o.email.toLowerCase(), o])).values());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-gray-600" />
            <h2 className="text-sm font-semibold text-gray-900">Choisir le destinataire</h2>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Liste des adresses */}
        <div className="px-5 py-4 space-y-2">
          {deduped.map((opt) => (
            <button
              key={opt.email}
              onClick={() => setSelected(opt.email)}
              className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                selected === opt.email
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{opt.email}</p>
                {opt.label && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {opt.label}
                    {opt.isPrimary && " · Facturation par défaut"}
                  </p>
                )}
                {!opt.label && opt.isPrimary && (
                  <p className="text-xs text-gray-500 mt-0.5">Facturation par défaut</p>
                )}
              </div>
              {selected === opt.email && <Check size={16} className="text-gray-900 shrink-0" />}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
