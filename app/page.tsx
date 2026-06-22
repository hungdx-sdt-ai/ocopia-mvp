import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: products, error } = await supabase
    .from("products")
    .select("*");

  if (error) {
    return <div>Lỗi: {error.message}</div>;
  }

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold mb-6">
        OCOPIA MVP
      </h1>

      {products?.map((product) => (
        <div
          key={product.id}
          className="border rounded p-4 mb-4"
        >
          <h2 className="text-xl font-bold">
            {product.name}
          </h2>

          <p>{product.story}</p>

          <p className="mt-2">
            Giá: {product.price.toLocaleString()} VNĐ
          </p>
        </div>
      ))}
    </main>
  );
}