import { useState } from "react";
import { Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import { toast } from "sonner";

export default function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success("Message envoyé ! Nous vous répondrons rapidement.");
    setFormData({ name: "", email: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-secondary text-white py-8">
        <div className="container">
          <h1 className="text-3xl md:text-4xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            Nous Contacter
          </h1>
          <p className="text-gray-400 text-sm mt-1">Nous sommes là pour vous aider</p>
        </div>
      </div>

      <div className="container py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <Phone size={24} className="text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-800 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Téléphone
                  </h3>
                  <p className="text-sm text-gray-600">+33 (0)X XX XX XX XX</p>
                  <p className="text-xs text-gray-500 mt-1">Lun-Ven 9h-18h</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <Mail size={24} className="text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-800 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Email
                  </h3>
                  <p className="text-sm text-gray-600">contact@barberparadise.fr</p>
                  <p className="text-xs text-gray-500 mt-1">Réponse sous 24h</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <MapPin size={24} className="text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-800 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Adresse
                  </h3>
                  <p className="text-sm text-gray-600">France Métropolitaine</p>
                  <p className="text-xs text-gray-500 mt-1">Livraison dans toute la France</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <Clock size={24} className="text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-gray-800 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Horaires
                  </h3>
                  <p className="text-sm text-gray-600">Lun-Ven 9h-18h</p>
                  <p className="text-xs text-gray-500 mt-1">Samedi 10h-16h</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-8 space-y-6">
              <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Envoyez-nous un Message
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-bp w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-bp w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sujet *</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input-bp w-full"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={6}
                  className="input-bp w-full resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={16} /> {isSubmitting ? "Envoi en cours..." : "Envoyer le message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
