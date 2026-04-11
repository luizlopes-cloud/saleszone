export default function InvalidLink() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold mb-4">Link inválido ou expirado</h1>
        <p className="text-gray-500 mb-6">Este link de acesso não é válido.</p>
        <a href="/webinar" className="text-blue-600 underline">Agendar uma nova apresentação</a>
      </div>
    </div>
  );
}
