"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  story: string;
  price: number;
  image_url: string;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Sub-page State
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);

  // Checkout State
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"banking" | "cod">("cod");
  const [formData, setFormData] = useState({
    customerName: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string>("");

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("id", { ascending: true });

        if (error) throw error;
        setProducts(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Không thể tải dữ liệu sản phẩm.");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const openCheckout = (product: Product) => {
    setActiveProduct(product);
    setQuantity(1);
    setPaymentMethod("cod");
    setFormData({ customerName: "", phone: "", address: "" });
    setIsCheckoutOpen(true);
    setIsSuccess(false);
    setCreatedOrderId("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) return;

    if (!formData.customerName.trim() || !formData.phone.trim() || !formData.address.trim()) {
      alert("Vui lòng điền đầy đủ thông tin.");
      return;
    }

    setIsSubmitting(true);
    try {
      const totalPrice = activeProduct.price * quantity;

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          total_price: totalPrice,
          payment_method: paymentMethod.toUpperCase(),
          status: "Pending",
        })
        .select();

      if (error) throw error;

      const insertedOrder = data?.[0];
      const orderId = insertedOrder?.id || insertedOrder?.order_id || "OCP-" + Math.floor(100000 + Math.random() * 900000);
      setCreatedOrderId(String(orderId));
      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      alert("Đã xảy ra lỗi khi đặt hàng: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProductTrustPoints = (id: number) => {
    if (id === 1) {
      return [
        "100% nguyên liệu thuần nông: Nếp Hương, Mè mẩy, Gừng sẻ tươi",
        "Quy trình 7 bước thủ công truyền thống ròng rã suốt 3 ngày",
        "Đạt chuẩn OCOP 4 Sao Đà Nẵng, không chất bảo quản",
      ];
    }
    return [
      "Mực ống tươi 100% đánh bắt tự nhiên tại vùng biển Đà Nẵng",
      "Xốt me gia truyền màu tự nhiên, tuyệt đối không chất bảo quản",
      "Đóng lon PET nắp nhôm xé màng seal hiện đại, đảm bảo vệ sinh",
    ];
  };

  const parseStory = (storyText: string) => {
    const sentences = storyText.split(/(?<=\. )/);
    if (sentences.length > 2) {
      const hook = sentences.slice(0, 2).join(" ");
      const core = sentences.slice(2).join(" ");
      return { hook, core };
    }
    return { hook: storyText, core: "" };
  };

  const renderCheckoutModal = () => {
    if (!isCheckoutOpen || !activeProduct) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={() => !isSubmitting && setIsCheckoutOpen(false)}
        ></div>

        {/* Modal Container */}
        <div className="relative w-full max-w-2xl glass-panel border border-white/10 rounded-md overflow-hidden z-10 max-h-[90vh] flex flex-col text-left">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-dark-bg/40">
            <h3 className="font-serif text-lg tracking-widest text-gold-accent uppercase">
              {isSuccess ? "ĐẶT HÀNG THÀNH CÔNG" : "THÔNG TIN THANH TOÁN"}
            </h3>
            {!isSubmitting && (
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto flex-grow space-y-6">
            {isSuccess ? (
              /* Success View */
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold animate-pulse">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h4 className="font-serif text-2xl text-white">Cảm ơn bạn đã đặt hàng!</h4>
                  <p className="font-sans text-xs text-[#eaeaea]/60">
                    Đơn hàng của bạn đã được hệ thống ghi nhận thành công.
                  </p>
                </div>

                {/* Order Details Receipt */}
                <div className="glass-panel border border-white/5 rounded p-4 text-left space-y-3 bg-white/[0.02]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-[#eaeaea]/50">Mã đơn hàng:</span>
                    <span className="text-xs font-mono font-bold text-gold-accent">{createdOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">Khách hàng:</span>
                    <span className="text-xs font-medium text-white">{formData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">Số điện thoại:</span>
                    <span className="text-xs font-medium text-white">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">Địa chỉ giao:</span>
                    <span className="text-xs font-medium text-white text-right max-w-[70%] truncate">
                      {formData.address}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-xs text-[#eaeaea]/50">Sản phẩm:</span>
                    <span className="text-xs font-medium text-white">
                      {activeProduct.name} (x{quantity})
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-sm font-bold text-gold-light">Tổng cộng:</span>
                    <span className="text-sm font-bold text-gold-light font-serif">
                      {(activeProduct.price * quantity).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>

                {/* Banking VietQR Code block */}
                {paymentMethod === "banking" && (
                  <div className="glass-panel border border-gold/20 rounded p-5 space-y-4 bg-gold/[0.02] text-center">
                    <span className="text-xs font-mono tracking-widest text-gold block">
                      QUÉT MÃ VIETQR ĐỂ THANH TOÁN
                    </span>
                    <div className="relative w-48 h-48 mx-auto border border-white/10 rounded overflow-hidden bg-white p-2">
                      <img
                        src={`https://img.vietqr.io/image/MB-123456789-compact2.png?amount=${activeProduct.price * quantity}&addInfo=${createdOrderId}&accountName=OCOPIA%20HERITAGE`}
                        alt="VietQR Payment Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left space-y-2 text-xs text-[#eaeaea]/70 max-w-sm mx-auto">
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">Ngân hàng:</span> <span className="font-semibold text-white">MB Bank</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">Số tài khoản:</span> <span className="font-semibold text-white">123456789</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">Chủ tài khoản:</span> <span className="font-semibold text-white">OCOPIA HERITAGE</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">Nội dung chuyển khoản:</span> <span className="font-mono font-bold text-gold-accent">{createdOrderId}</span></p>
                    </div>
                    <p className="text-[10px] text-gold-accent/50 italic max-w-sm mx-auto">
                      * Hệ thống sẽ tự động chuyển đổi trạng thái khi giao dịch hoàn tất.
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setActiveDetailProduct(null); // return to catalog on complete
                    }}
                    className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors"
                  >
                    HOÀN THÀNH
                  </button>
                </div>
              </div>
            ) : (
              /* Checkout Form View */
              <form onSubmit={handleSubmitOrder} className="space-y-6">
                {/* Selected Product Summary Card */}
                <div className="flex gap-4 p-4 border border-white/5 rounded-sm bg-white/[0.01]">
                  <img
                    src={activeProduct.image_url}
                    alt={activeProduct.name}
                    className="w-20 h-20 object-cover rounded border border-white/5"
                  />
                  <div className="flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="font-serif text-base text-white">{activeProduct.name}</h4>
                      <p className="text-xs text-gold-accent font-serif mt-0.5">
                        {activeProduct.price.toLocaleString("vi-VN")} VNĐ
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#eaeaea]/40">Số lượng:</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-6 h-6 rounded-full border border-white/10 hover:border-gold/50 flex items-center justify-center text-xs text-white transition-colors"
                        >
                          -
                        </button>
                        <span className="text-sm font-semibold w-6 text-center text-white">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-6 h-6 rounded-full border border-white/10 hover:border-gold/50 flex items-center justify-center text-xs text-white transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col justify-end">
                    <span className="text-[10px] text-[#eaeaea]/40 block uppercase">Tổng tiền</span>
                    <span className="font-serif text-lg text-gold font-bold">
                      {(activeProduct.price * quantity).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      Họ và tên <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder="Nhập đầy đủ họ và tên"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      Số điện thoại <span className="text-gold">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder="Nhập số điện thoại nhận hàng"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      Địa chỉ nhận hàng <span className="text-gold">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder="Nhập chi tiết địa chỉ giao hàng"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono block">
                    Phương thức thanh toán
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* COD Box */}
                    <label
                      className={`flex flex-col p-4 border rounded-sm cursor-pointer transition-all duration-300 ${
                        paymentMethod === "cod"
                          ? "border-gold bg-gold/5"
                          : "border-white/10 hover:border-white/25 bg-[#14151a]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                        className="sr-only"
                        disabled={isSubmitting}
                      />
                      <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                        Thanh toán COD
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        Thanh toán bằng tiền mặt khi nhận hàng.
                      </span>
                    </label>

                    {/* Banking Box */}
                    <label
                      className={`flex flex-col p-4 border rounded-sm cursor-pointer transition-all duration-300 ${
                        paymentMethod === "banking"
                          ? "border-gold bg-gold/5"
                          : "border-white/10 hover:border-white/25 bg-[#14151a]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="banking"
                        checked={paymentMethod === "banking"}
                        onChange={() => setPaymentMethod("banking")}
                        className="sr-only"
                        disabled={isSubmitting}
                      />
                      <span className="text-xs font-serif font-bold text-white uppercase tracking-wider">
                        Chuyển khoản (VietQR)
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        Quét mã VietQR thanh toán nhanh 24/7.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutOpen(false)}
                    disabled={isSubmitting}
                    className="w-1/3 border border-white/15 hover:border-white/30 text-white font-serif text-xs tracking-widest py-3.5 px-6 rounded-sm transition-colors"
                  >
                    HỦY BỎ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3.5 px-8 rounded-sm hover:bg-gold-light transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-bg border-t-transparent"></div>
                        ĐANG XỬ LÝ...
                      </>
                    ) : (
                      "XÁC NHẬN ĐẶT HÀNG"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (activeDetailProduct) {
    const { hook, core } = parseStory(activeDetailProduct.story);
    const trustPoints = getProductTrustPoints(activeDetailProduct.id);

    return (
      <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
        {/* Background Decorative Blur Lines */}
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Header */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between">
          <button
            onClick={() => setActiveDetailProduct(null)}
            className="flex items-center gap-2 font-serif text-xs tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors uppercase"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Quay lại
          </button>
          
          <div
            className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold select-none cursor-pointer"
            onClick={() => setActiveDetailProduct(null)}
          >
            Ocopia
          </div>

          <button
            onClick={() => openCheckout(activeDetailProduct)}
            className="font-serif text-xs tracking-widest bg-gold text-dark-bg hover:bg-gold-light transition-all duration-300 font-semibold py-2 px-6 rounded-sm uppercase"
          >
            Mua ngay
          </button>
        </header>

        {/* Detail Content */}
        <main className="flex-grow z-10 max-w-7xl mx-auto px-6 md:px-12 py-20 w-full flex items-center justify-center">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center w-full">
            {/* Left: Product Image */}
            <div className="w-full lg:w-1/2 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-gold/30 to-gold-accent/10 rounded-lg blur opacity-25"></div>
              <div className="relative aspect-[4/3] rounded-lg overflow-hidden glass-panel border border-white/10 shadow-2xl">
                <img
                  src={activeDetailProduct.image_url}
                  alt={activeDetailProduct.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4 bg-dark-bg/85 backdrop-blur-md border border-gold/30 px-3 py-1 rounded-sm text-[10px] font-mono tracking-widest text-gold-accent">
                  {activeDetailProduct.id === 1 ? "OCOP 4 SAO" : "OCOP 3 SAO"}
                </div>
              </div>
            </div>

            {/* Right: Text Details */}
            <div className="w-full lg:w-1/2 space-y-6 text-left">
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white font-light uppercase tracking-wider">
                {activeDetailProduct.name}
              </h1>

              {/* Price */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#eaeaea]/40">Đơn giá</span>
                <p className="font-serif text-3xl text-gold-light font-medium">
                  {activeDetailProduct.price.toLocaleString("vi-VN")} VNĐ
                </p>
              </div>

              <div className="w-full h-[1px] bg-white/5"></div>

              {/* Hook */}
              <p className="font-serif italic text-base md:text-lg text-gold-light/95 leading-relaxed border-l-2 border-gold/40 pl-4">
                {hook}
              </p>

              {/* Story */}
              <p className="font-sans text-sm text-[#eaeaea]/70 leading-relaxed font-light">
                {core}
              </p>

              {/* Trust factors */}
              <div className="space-y-3 pt-2">
                {trustPoints.map((point, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-gold shrink-0 mt-0.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    <span className="font-sans text-xs text-[#eaeaea]/80 font-light">{point}</span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-white/5 flex gap-4">
                <button
                  onClick={() => setActiveDetailProduct(null)}
                  className="font-serif text-xs tracking-widest border border-white/20 text-[#eaeaea]/80 hover:border-gold hover:text-gold transition-all duration-300 font-semibold py-4 px-6 rounded-sm uppercase"
                >
                  Quay lại trang chủ
                </button>
                <button
                  onClick={() => openCheckout(activeDetailProduct)}
                  className="font-serif text-xs tracking-widest bg-gold text-dark-bg hover:bg-gold-light transition-all duration-300 font-semibold py-4 px-10 rounded-sm uppercase flex-grow text-center"
                >
                  MUA NGAY
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Checkout Modal */}
        {renderCheckoutModal()}

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 px-6 md:px-12 bg-dark-bg/60 text-center">
          <span className="font-serif text-sm tracking-[0.2em] gold-gradient-text uppercase font-bold block mb-2">
            OCOPIA HERITAGE
          </span>
          <p className="font-sans text-[10px] text-[#eaeaea]/40">
            © 2026 Ocopia. Chương trình đặc sản vùng miền di sản Việt Nam.
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
      {/* Background Decorative Blur Lines */}
      <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl font-bold tracking-[0.2em] gold-gradient-text uppercase">
            Ocopia
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest bg-gold/10 text-gold-accent border border-gold/20 px-2 py-0.5 rounded">
            Heritage
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 font-serif text-sm tracking-widest text-[#eaeaea]/80">
          <a href="#showroom" className="hover:text-gold transition-colors">SẢN PHẨM</a>
          <a href="#about" className="hover:text-gold transition-colors">CÂU CHUYỆN</a>
        </nav>
        <div>
          <a
            href="#showroom"
            className="font-serif text-xs tracking-widest border border-gold/50 text-gold hover:bg-gold hover:text-dark-bg transition-all duration-300 py-2 px-5 rounded-sm"
          >
            SẢN PHẨM
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow z-10">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex flex-col md:flex-row items-center justify-between px-6 md:px-16 lg:px-24 py-20 gap-12 max-w-7xl mx-auto w-full">
          {/* Left/Center: Large Centered Logo & Visual */}
          <div className="flex-grow flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center text-gold shadow-lg shadow-gold/5">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3M5.315 5.315l13.37 13.37m0-13.37l-13.37 13.37" />
              </svg>
            </div>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-[0.25em] text-white font-extralight uppercase select-none leading-none">
              Ocopia
            </h1>
            <div className="w-24 h-[1px] bg-gold/40"></div>
            <p className="font-serif italic text-base md:text-lg text-gold-accent tracking-widest">
              TINH HOA NÔNG SẢN VIỆT
            </p>
          </div>

          {/* Right: Reserved Box for Startup Story */}
          <div className="w-full md:w-[420px] shrink-0 text-left">
            <div className="glass-panel border border-gold/25 rounded-md p-8 relative overflow-hidden space-y-6 shadow-2xl bg-dark-surface/40">
              {/* Top accent highlight */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-gold/50 via-gold-accent to-gold/50"></div>
              
              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-[0.3em] text-gold uppercase block">
                  HERITAGE STORY
                </span>
                <h3 className="font-serif text-2xl text-white font-light tracking-wider">
                  Câu Chuyện Khởi Nghiệp
                </h3>
              </div>
              
              <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed font-light italic">
                "Không gian dành riêng cho câu chuyện hành trình khởi nghiệp đầy cảm hứng của dự án Ocopia. Câu chuyện đưa các nông sản đặc sản vùng miền vươn lên chuẩn mực chất lượng mới sẽ sớm được cập nhật tại đây..."
              </p>
              
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <span className="text-[9px] font-mono text-gold-accent/40 uppercase tracking-widest">Đang cập nhật</span>
                <div className="w-2 h-2 rounded-full bg-gold/40 animate-pulse"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Product Showroom Stage */}
        <section id="showroom" className="max-w-4xl mx-auto px-6 py-24 space-y-36">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">DANH MỤC SẢN PHẨM</span>
            <h2 className="font-serif text-3xl md:text-5xl font-light text-white uppercase tracking-wider">
              Sản Phẩm Di Sản
            </h2>
            <div className="w-16 h-[1px] bg-gold/40 mx-auto"></div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold"></div>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-400 font-sans glass-panel p-6 rounded-md max-w-md mx-auto">
              {error}
            </div>
          ) : (
            <div className="space-y-32">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col items-center text-center space-y-8"
                >
                  {/* Center aligned package image */}
                  <div className="w-full max-w-md relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-gold/20 to-gold-accent/5 rounded-lg blur opacity-20 group-hover:opacity-35 transition duration-1000"></div>
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden glass-panel border border-white/10 shadow-2xl">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover transform group-hover:scale-103 transition-transform duration-700"
                      />
                    </div>
                  </div>

                  {/* Product title and Xem thêm button */}
                  <div className="space-y-4">
                    <h3 className="font-serif text-3xl md:text-4xl text-white font-light uppercase tracking-widest">
                      {product.name}
                    </h3>
                    <div className="w-12 h-[1px] bg-gold/30 mx-auto"></div>
                    <button
                      onClick={() => setActiveDetailProduct(product)}
                      className="font-serif text-xs tracking-[0.2em] border border-gold/40 text-gold hover:bg-gold hover:text-dark-bg transition-all duration-300 font-semibold py-3.5 px-10 rounded-sm uppercase cursor-pointer"
                    >
                      XEM THÊM
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Checkout Modal */}
      {renderCheckoutModal()}

      {/* Footer */}
      <footer id="about" className="border-t border-white/5 py-12 px-6 md:px-12 bg-dark-bg/60 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase">
            OCOPIA HERITAGE
          </span>
          <p className="font-sans text-xs text-[#eaeaea]/55 leading-relaxed font-light">
            © 2026 Ocopia. Bản quyền thuộc về đội ngũ phát triển dự án Ocopia. Chương trình liên kết phát triển nông sản Việt bền vững.
          </p>
        </div>
      </footer>
    </div>
  );
}