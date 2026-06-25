"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { translations } from "@/lib/translations";

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

  const [lang, setLang] = useState<"vi" | "en">("vi");
  const [isDark, setIsDark] = useState<boolean>(true);

  // Load language and theme preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem("lang") as "vi" | "en";
      if (savedLang) setLang(savedLang);

      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "light") {
        setIsDark(false);
        document.documentElement.classList.add("light");
      } else {
        setIsDark(true);
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const toggleLang = () => {
    const nextLang = lang === "vi" ? "en" : "vi";
    setLang(nextLang);
    localStorage.setItem("lang", nextLang);
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    }
  };

  const t = translations[lang] as any;


  // Detail Sub-page State
  const [activeDetailProduct, setActiveDetailProduct] = useState<Product | null>(null);
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  const handleOpenDetail = (product: Product) => {
    setSavedScrollPosition(window.scrollY);
    setActiveDetailProduct(product);
    window.scrollTo(0, 0);
  };

  const handleCloseDetail = () => {
    setActiveDetailProduct(null);
    setTimeout(() => {
      window.scrollTo(0, savedScrollPosition);
    }, 50);
  };

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

  // Banking QR + Countdown State
  const [bankingQR, setBankingQR] = useState<{
    qrCode: string;
    orderId: number;
    checkoutUrl: string;
  } | null>(null);
  const [qrCountdown, setQrCountdown] = useState(300);

  // PayOS Redirect Status State
  const [paymentRedirectStatus, setPaymentRedirectStatus] = useState<{
    status: "success" | "cancelled";
    orderId: string;
  } | null>(null);

  // Handle PayOS redirect parameters on mount + back button detection via pageshow
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hàm xử lý hủy đơn khi user quay lại mà không hoàn tất thanh toán
    const cancelPendingOrder = () => {
      const pendingOrderStr = sessionStorage.getItem("pendingPayOSOrder");
      if (!pendingOrderStr) return;
      try {
        const pendingOrder = JSON.parse(pendingOrderStr);
        sessionStorage.removeItem("pendingPayOSOrder");
        supabase
          .from("orders")
          .update({ status: "Cancelled" })
          .eq("id", pendingOrder.orderId)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi khi hủy đơn do user quay lại:", error);
            } else {
              console.log(`Đơn hàng #${pendingOrder.orderId} đã bị hủy do user quay lại trang.`);
            }
          });
        setPaymentRedirectStatus({
          status: "cancelled",
          orderId: String(pendingOrder.orderId)
        });
      } catch {
        sessionStorage.removeItem("pendingPayOSOrder");
      }
    };

    // Xử lý URL params từ PayOS redirect (success / cancelled)
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get("status");
    // PayOS có thể trả về 'orderId' (custom) hoặc 'orderCode' (của PayOS)
    const orderIdParam = params.get("orderId") || params.get("orderCode");
    
    if (statusParam && orderIdParam) {
      // Có URL params → đến từ redirect của PayOS → xóa pending order trong sessionStorage
      sessionStorage.removeItem("pendingPayOSOrder");
      const normalizedStatus = statusParam.toLowerCase();

      if (normalizedStatus === "success") {
        setPaymentRedirectStatus({ status: "success", orderId: orderIdParam });
      } else if (normalizedStatus === "cancelled" || normalizedStatus === "cancel") {
        supabase
          .from("orders")
          .update({ status: "Cancelled" })
          .eq("id", orderIdParam)
          .then(({ error }) => {
            if (error) {
              console.error("Lỗi khi cập nhật trạng thái hủy đơn:", error);
            } else {
              console.log(`Đơn hàng #${orderIdParam} đã được cập nhật thành Cancelled.`);
            }
          });
        setPaymentRedirectStatus({ status: "cancelled", orderId: orderIdParam });
      }
      
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    // Lắng nghe sự kiện 'pageshow' để phát hiện bfcache restore (bấm nút Back trình duyệt)
    // useEffect không chạy lại khi bfcache restore, nhưng 'pageshow' luôn kích hoạt
    const handlePageShow = (e: PageTransitionEvent) => {
      // e.persisted = true nghĩa là trang được khôi phục từ bfcache (bấm Back)
      if (e.persisted) {
        cancelPendingOrder();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Countdown timer for banking QR payment (5 minutes)
  useEffect(() => {
    if (!bankingQR) return;
    setQrCountdown(300);
    const capturedOrderId = bankingQR.orderId;
    const timer = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hết giờ → tự động hủy đơn
          supabase
            .from("orders")
            .update({ status: "Cancelled" })
            .eq("id", capturedOrderId)
            .then(({ error }) => {
              if (!error) console.log(`Đơn hàng #${capturedOrderId} hết hạn QR đã bị hủy.`);
            });
          setBankingQR(null);
          setIsCheckoutOpen(false);
          setPaymentRedirectStatus({ status: "cancelled", orderId: String(capturedOrderId) });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankingQR?.orderId]);

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
      alert(t.fillAllFields);
      return;
    }

    setIsSubmitting(true);
    try {
      const totalPrice = activeProduct.price * quantity;
      const orderStatus = paymentMethod === "cod" ? "COD_CONFIRMED" : "Pending";

      const { data, error } = await supabase
        .from("orders")
        .insert({
          customer_name: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          total_price: totalPrice,
          payment_method: paymentMethod.toUpperCase(),
          status: orderStatus,
        })
        .select();

      if (error) throw error;

      const insertedOrder = data?.[0];
      const orderId = insertedOrder?.id || insertedOrder?.order_id || "OCP-" + Math.floor(100000 + Math.random() * 900000);
      setCreatedOrderId(String(orderId));

      if (paymentMethod === "banking") {
        const checkoutResponse = await fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: orderId,
            totalPrice: totalPrice,
            productName: activeProduct.name,
            origin: window.location.origin,
          }),
        });

        const checkoutData = await checkoutResponse.json();

        if (checkoutResponse.ok && checkoutData.checkoutUrl) {
          // Hiển QR trực tiếp trên trang thay vì redirect sang PayOS
          setBankingQR({
            qrCode: checkoutData.qrCode || "",
            orderId: Number(orderId),
            checkoutUrl: checkoutData.checkoutUrl,
          });
        } else {
          throw new Error(checkoutData.error || "Không thể khởi tạo cổng thanh toán PayOS.");
        }
      } else {
        // COD: insert vào bảng completed_orders
        const { error: completedError } = await supabase
          .from("completed_orders")
          .insert({
            order_id: insertedOrder?.id,
            customer_name: formData.customerName,
            phone: formData.phone,
            address: formData.address,
            total_price: totalPrice,
            payment_method: "COD",
            status: "COD_CONFIRMED",
          });

        if (completedError) {
          console.error("Lỗi khi lưu đơn COD vào completed_orders:", completedError);
        } else {
          console.log(`Đơn hàng COD #${insertedOrder?.id} đã được lưu vào completed_orders.`);
        }

        setIsSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      alert(t.orderError + err.message);
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
              {bankingQR ? t.qrTitle : isSuccess ? t.checkoutSuccess : t.checkoutTitle}
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
            {bankingQR ? (
              /* Banking QR + Countdown View */
              <div className="text-center space-y-6 py-4">
                {/* Countdown Timer */}
                <div className="space-y-1">
                  <p className="font-mono text-xs tracking-widest text-[#eaeaea]/40 uppercase">{t.qrTimeRemaining}</p>
                  <div className={`font-serif text-5xl font-bold tabular-nums ${
                    qrCountdown <= 60 ? "text-red-400" : qrCountdown <= 120 ? "text-amber-400" : "text-gold"
                  }`}>
                    {String(Math.floor(qrCountdown / 60)).padStart(2, "0")}:{String(qrCountdown % 60).padStart(2, "0")}
                  </div>
                  <p className="font-sans text-[10px] text-[#eaeaea]/40">
                    {qrCountdown <= 60 ? t.qrExpiring : t.qrExpiry}
                  </p>
                </div>

                {/* QR Code */}
                <div className="relative w-52 h-52 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-gold/30 to-gold-accent/20 rounded-lg blur opacity-40"></div>
                  <div className="relative bg-white rounded-lg p-3 border border-gold/20 shadow-xl">
                    {bankingQR.qrCode ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(bankingQR.qrCode)}&size=200x200&color=0A0B0F&bgcolor=FFFFFF`}
                        alt="Mã QR Thanh toán PayOS"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Đang tải mã QR...</div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="glass-panel border border-white/5 rounded p-4 text-left space-y-2 bg-white/[0.02] text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelOrderId}</span>
                    <span className="font-mono font-bold text-gold-accent">#{bankingQR.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelAmount}</span>
                    <span className="font-bold text-white">{activeProduct ? (activeProduct.price * quantity).toLocaleString("vi-VN") : ""} VNĐ</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.qrLabelContent}</span>
                    <span className="font-mono text-white">Thanh toan don {bankingQR.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#eaeaea]/40">{t.vietqrHolder}</span>
                    <span className="font-bold text-white">DANG XUAN HUNG</span>
                  </div>
                </div>

                <p className="font-sans text-[10px] text-[#eaeaea]/40 italic">
                  {t.qrAutoConfirm}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      supabase.from("orders").update({ status: "Cancelled" }).eq("id", bankingQR.orderId)
                        .then(() => {
                          setBankingQR(null);
                          setIsCheckoutOpen(false);
                          setPaymentRedirectStatus({ status: "cancelled", orderId: String(bankingQR.orderId) });
                        });
                    }}
                    className="flex-1 border border-white/15 hover:border-red-500/50 text-white/60 hover:text-red-400 font-serif text-xs tracking-widest py-3 px-4 rounded-sm transition-colors"
                  >
                    {t.qrCancelBtn}
                  </button>
                  <a
                    href={bankingQR.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 border border-gold/30 hover:border-gold text-gold/70 hover:text-gold font-serif text-xs tracking-widest py-3 px-4 rounded-sm transition-colors flex items-center justify-center gap-1"
                  >
                    {t.qrOpenPayos}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : isSuccess ? (
              /* Success View */
              <div className="text-center space-y-6 py-6">
                <div className="w-16 h-16 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold animate-pulse">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h4 className="font-serif text-2xl text-white">{t.thankYou}</h4>
                  <p className="font-sans text-xs text-[#eaeaea]/60">
                    {t.orderRecorded}
                  </p>
                </div>

                {/* Order Details Receipt */}
                <div className="glass-panel border border-white/5 rounded p-4 text-left space-y-3 bg-white/[0.02]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelOrderId}</span>
                    <span className="text-xs font-mono font-bold text-gold-accent">{createdOrderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelCustomer}</span>
                    <span className="text-xs font-medium text-white">{formData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelPhoneReceipt}</span>
                    <span className="text-xs font-medium text-white">{formData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelDeliveryAddr}</span>
                    <span className="text-xs font-medium text-white text-right max-w-[70%] truncate">
                      {formData.address}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-xs text-[#eaeaea]/50">{t.labelProduct}</span>
                    <span className="text-xs font-medium text-white">
                      {(t.products[String(activeProduct.id)]?.name || activeProduct.name)} (x{quantity})
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-sm font-bold text-gold-light">{t.labelTotal}</span>
                    <span className="text-sm font-bold text-gold-light font-serif">
                      {(activeProduct.price * quantity).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>

                {/* Banking VietQR Code block */}
                {paymentMethod === "banking" && (
                  <div className="glass-panel border border-gold/20 rounded p-5 space-y-4 bg-gold/[0.02] text-center">
                    <span className="text-xs font-mono tracking-widest text-gold block">
                      {t.vietqrTitle}
                    </span>
                    <div className="relative w-48 h-48 mx-auto border border-white/10 rounded overflow-hidden bg-white p-2">
                      <img
                        src={`https://img.vietqr.io/image/MB-123456789-compact2.png?amount=${activeProduct.price * quantity}&addInfo=${createdOrderId}&accountName=DANG%20XUAN%20HUNG`}
                        alt="VietQR Payment Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-left space-y-2 text-xs text-[#eaeaea]/70 max-w-sm mx-auto">
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrBank}</span> <span className="font-semibold text-white">MB Bank</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrAccount}</span> <span className="font-semibold text-white">123456789</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrHolder}</span> <span className="font-semibold text-white">DANG XUAN HUNG</span></p>
                      <p className="flex justify-between"><span className="text-[#eaeaea]/40">{t.vietqrDesc}</span> <span className="font-mono font-bold text-gold-accent">{createdOrderId}</span></p>
                    </div>
                    <p className="text-[10px] text-gold-accent/50 italic max-w-sm mx-auto">
                      {t.vietqrSystemAuto}
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      handleCloseDetail(); // return to catalog on complete
                    }}
                    className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors"
                  >
                    {t.doneBtn}
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
                      <h4 className="font-serif text-base text-white">{(t.products[String(activeProduct.id)]?.name || activeProduct.name)}</h4>
                      <p className="text-xs text-gold-accent font-serif mt-0.5">
                        {activeProduct.price.toLocaleString("vi-VN")} VNĐ
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#eaeaea]/40">{t.quantity}</span>
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
                    <span className="text-[10px] text-[#eaeaea]/40 block uppercase">{t.subtotal}</span>
                    <span className="font-serif text-lg text-gold font-bold">
                      {(activeProduct.price * quantity).toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelName} <span className="text-gold">*</span>
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderName}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelPhone} <span className="text-gold">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderPhone}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono">
                      {t.labelAddress} <span className="text-gold">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      rows={3}
                      disabled={isSubmitting}
                      className="w-full bg-[#14151a]/80 border border-white/10 focus:border-gold focus:outline-none rounded-sm px-4 py-2.5 text-sm text-white font-sans transition-colors placeholder:text-white/20"
                      placeholder={t.placeholderAddress}
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-[#eaeaea]/50 font-mono block">
                    {t.paymentMethod}
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
                        {t.codTitle}
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        {t.codDesc}
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
                        {t.bankingTitle}
                      </span>
                      <span className="text-[10px] text-[#eaeaea]/55 mt-1">
                        {t.bankingDesc}
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
                    {t.cancelBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3 font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3.5 px-8 rounded-sm hover:bg-gold-light transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-dark-bg border-t-transparent"></div>
                        {t.processingBtn}
                      </>
                    ) : (
                      t.confirmBtn
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

  const renderRedirectStatusModal = () => {
    if (!paymentRedirectStatus) return null;

    const isSuccess = paymentRedirectStatus.status === "success";

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
          onClick={() => setPaymentRedirectStatus(null)}
        ></div>

        {/* Modal Container */}
        <div className="relative w-full max-w-md glass-panel border border-white/10 rounded-md overflow-hidden z-10 p-8 text-center space-y-6">
          {isSuccess ? (
            <>
              <div className="w-16 h-16 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold animate-bounce">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl text-white uppercase tracking-wider">{t.paymentSuccessTitle}</h3>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectSuccessDesc1} <span className="font-mono text-gold-accent font-bold">#{paymentRedirectStatus.orderId}</span> {t.redirectSuccessDesc2}
                </p>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectSuccessDesc3}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-serif text-2xl text-white uppercase tracking-wider">{t.paymentCancelledTitle}</h3>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectCancelledDesc1} <span className="font-mono text-gold-accent font-bold">#{paymentRedirectStatus.orderId}</span> {t.redirectCancelledDesc2}
                </p>
                <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed">
                  {t.redirectCancelledDesc3}
                </p>
              </div>
            </>
          )}

          <div className="pt-2">
            <button
              onClick={() => setPaymentRedirectStatus(null)}
              className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors"
            >
              {t.closeBtn}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (activeDetailProduct) {
    const localizedProduct = t.products[String(activeDetailProduct.id)];
    const productStory = localizedProduct?.story || activeDetailProduct.story;
    const { hook, core } = parseStory(productStory);
    const trustPoints = localizedProduct?.trustPoints || getProductTrustPoints(activeDetailProduct.id);

    // Ingredients Data
    const ingredients = activeDetailProduct.id === 1 ? [
      {
        name: localizedProduct?.ingredients?.[0]?.name || "Nếp Hương Bầu",
        desc: localizedProduct?.ingredients?.[0]?.desc || "",
        img: "/g_nep_huong.jpg"
      },
      {
        name: localizedProduct?.ingredients?.[1]?.name || "Đường Mía Điện Bàn",
        desc: localizedProduct?.ingredients?.[1]?.desc || "",
        img: "/g_duong_mia.jpg"
      },
      {
        name: localizedProduct?.ingredients?.[2]?.name || "Mè Mẩy Rang Củi",
        desc: localizedProduct?.ingredients?.[2]?.desc || "",
        img: "/g_me_rang.jpg"
      },
      {
        name: localizedProduct?.ingredients?.[3]?.name || "Gừng Sẻ Cay Nồng",
        desc: localizedProduct?.ingredients?.[3]?.desc || "",
        img: "/g_sot_me.jpg"
      }
    ] : [
      {
        name: localizedProduct?.ingredients?.[0]?.name || "Mực Khô Hảo Hạng",
        desc: localizedProduct?.ingredients?.[0]?.desc || "",
        img: "/g_muc_kho.jpg"
      },
      {
        name: localizedProduct?.ingredients?.[1]?.name || "Me Chín Tự Nhiên",
        desc: localizedProduct?.ingredients?.[1]?.desc || "",
        img: "/g_me_chin.jpg"
      },
      {
        name: localizedProduct?.ingredients?.[2]?.name || "Ớt & Tỏi Bản Địa",
        desc: localizedProduct?.ingredients?.[2]?.desc || "",
        img: "/g_ot_toi.jpg"
      }
    ];

    const lifestyle = activeDetailProduct.id === 1 ? {
      title: localizedProduct?.lifestyle?.title || "Thưởng thức đượm tình quê",
      desc: localizedProduct?.lifestyle?.desc || "",
      img: "/g_banh_me_tea.jpg"
    } : {
      title: localizedProduct?.lifestyle?.title || "Nhâm nhi cùng tri kỷ",
      desc: localizedProduct?.lifestyle?.desc || "",
      img: "/g_muc_rim_lifestyle.jpg"
    };

    return (
      <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
        {/* Background Decorative Blur Lines */}
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Header */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between">
          <button
            onClick={() => handleCloseDetail()}
            className="flex items-center gap-2 font-serif text-xs tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors uppercase"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.backBtn}
          </button>
          
          <div
            className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold select-none cursor-pointer"
            onClick={() => handleCloseDetail()}
          >
            Ocopia
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="text-gold hover:text-gold-light transition-colors p-1"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className="font-serif text-xs font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-1"
              aria-label="Toggle language"
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>

            <button
              onClick={() => openCheckout(activeDetailProduct)}
              className="font-serif text-xs tracking-widest bg-gold text-dark-bg hover:bg-gold-light transition-all duration-300 font-semibold py-2 px-6 rounded-sm uppercase"
            >
              {t.buyNow}
            </button>
          </div>
        </header>

        {/* Detail Content (Vertical scrolling layout like Lady Triệu) */}
        <main className="flex-grow z-10 w-full">
          {/* Part 1: Product Hero Section */}
          <section className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase bg-gold/5 border border-gold/10 px-4 py-1.5 rounded-full inline-block">
              {activeDetailProduct.id === 1 ? t.ocop4 : t.ocop3}
            </span>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-white font-light uppercase tracking-wider leading-tight">
              {localizedProduct?.name || activeDetailProduct.name}
            </h1>
            
            {/* Center Aligned Product Packaging Image */}
            <div className="max-w-md mx-auto relative group py-4">
              <div className="absolute -inset-1 bg-gradient-to-r from-gold/30 to-gold-accent/10 rounded-lg blur opacity-25"></div>
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden glass-panel border border-white/10 shadow-2xl">
                <img
                  src={activeDetailProduct.image_url}
                  alt={activeDetailProduct.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Slogan Hook */}
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="font-serif italic text-lg md:text-xl text-gold-light/95 leading-relaxed pl-4 border-l-2 border-gold/40 max-w-xl mx-auto">
                {hook}
              </p>
              <p className="font-sans text-sm text-[#eaeaea]/70 leading-relaxed font-light">
                {core}
              </p>
              <div className="pt-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#eaeaea]/40 block mb-1">{t.unitPrice}</span>
                <span className="font-serif text-3xl text-gold font-bold">
                  {activeDetailProduct.price.toLocaleString("vi-VN")} VNĐ
                </span>
              </div>
              <div className="pt-4">
                <button
                  onClick={() => openCheckout(activeDetailProduct)}
                  className="font-serif text-xs tracking-widest bg-gold text-dark-bg hover:bg-gold-light transition-all duration-300 font-semibold py-4 px-12 rounded-sm uppercase shadow-lg shadow-gold/5"
                >
                  {t.buyNowBtn}
                </button>
              </div>
            </div>
          </section>

          {/* Part 2: Ingredients Section (Middle) */}
          <section className="bg-dark-surface/40 border-y border-white/5 py-24 px-6 md:px-12 w-full">
            <div className="max-w-6xl mx-auto space-y-16">
              <div className="text-center space-y-3">
                <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{t.ingredientsLabel}</span>
                <h2 className="font-serif text-3xl md:text-4xl text-white font-light uppercase tracking-widest">
                  {t.ingredientsTitle}
                </h2>
                <div className="w-12 h-[1px] bg-gold/30 mx-auto"></div>
              </div>

              {/* Grid of separated ingredients */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {ingredients.map((ing, index) => (
                  <div
                    key={index}
                    className="glass-panel border border-white/5 rounded-md p-6 flex flex-col space-y-4 hover:border-gold/25 transition-colors duration-300 bg-white/[0.01]"
                  >
                    {/* Illustration image */}
                    <div className="aspect-[4/3] w-full rounded overflow-hidden border border-white/5 relative bg-dark-bg/60">
                      <img
                        src={ing.img}
                        alt={ing.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-serif text-lg font-medium text-gold-accent tracking-wide uppercase">
                        {ing.name}
                      </h4>
                      <p className="font-sans text-xs text-[#eaeaea]/60 leading-relaxed font-light">
                        {ing.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Part 3: Lifestyle / In-Use Section (Bottom) */}
          <section className="w-full py-24 px-6 md:px-12 max-w-5xl mx-auto text-center space-y-12">
            <div className="space-y-3">
              <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{t.experienceLabel}</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white font-light uppercase tracking-widest">
                {lifestyle.title}
              </h2>
              <div className="w-12 h-[1px] bg-gold/30 mx-auto"></div>
            </div>

            {/* Large full-width image depicting usage */}
            <div className="relative group rounded-lg overflow-hidden border border-white/10 shadow-2xl glass-panel aspect-[21/9] w-full">
              <img
                src={lifestyle.img}
                alt={lifestyle.title}
                className="w-full h-full object-cover transform group-hover:scale-101 transition-transform duration-700"
              />
            </div>

            <p className="max-w-2xl mx-auto font-sans text-sm text-[#eaeaea]/70 leading-relaxed font-light italic">
              "{lifestyle.desc}"
            </p>

            {/* Double action layout */}
            <div className="pt-6 flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <button
                onClick={() => handleCloseDetail()}
                className="font-serif text-xs tracking-widest border border-white/15 text-[#eaeaea]/80 hover:border-gold hover:text-gold transition-all duration-300 font-semibold py-4 px-8 rounded-sm uppercase"
              >
                {t.backToStore}
              </button>
              <button
                onClick={() => openCheckout(activeDetailProduct)}
                className="font-serif text-xs tracking-widest bg-gold text-dark-bg hover:bg-gold-light transition-all duration-300 font-semibold py-4 px-10 rounded-sm uppercase flex-grow"
              >
                {t.buyNowBtn}
              </button>
            </div>
          </section>
        </main>

        {/* Checkout Modal */}
        {renderCheckoutModal()}

        {/* PayOS Redirect Status Modal */}
        {renderRedirectStatusModal()}

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 px-6 md:px-12 bg-dark-bg/60 text-center">
          <span className="font-serif text-sm tracking-[0.2em] gold-gradient-text uppercase font-bold block mb-2">
            OCOPIA HERITAGE
          </span>
          <p className="font-sans text-[10px] text-[#eaeaea]/40">
            {t.footerCopyright}
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
          <a href="#showroom" className="hover:text-gold transition-colors">{t.navProducts}</a>
          <a href="#about" className="hover:text-gold transition-colors">{t.navStory}</a>
        </nav>
        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="text-gold hover:text-gold-light transition-colors p-1"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="font-serif text-xs font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-1"
            aria-label="Toggle language"
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>

          <a
            href="#showroom"
            className="font-serif text-xs tracking-widest border border-gold/50 text-gold hover:bg-gold hover:text-dark-bg transition-all duration-300 py-2 px-5 rounded-sm"
          >
            {t.navCta}
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow z-10">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex flex-col md:flex-row items-center justify-between px-6 md:px-16 lg:px-24 py-20 gap-12 max-w-7xl mx-auto w-full">
          {/* Left/Center: Large Centered Logo & Visual */}
          <div className="flex-grow flex flex-col items-center text-center space-y-6">
            <div className="w-28 h-28 relative rounded-full overflow-hidden shadow-lg shadow-gold/5">
              <img
                src="/background.jpg"
                alt="Ocopia Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl tracking-[0.25em] text-white font-extralight uppercase select-none leading-none">
              Ocopia
            </h1>
            <div className="w-24 h-[1px] bg-gold/40"></div>
            <p className="font-serif italic text-sm md:text-base text-gold-accent tracking-widest uppercase">
              {t.heroTagline}
            </p>
          </div>

          {/* Right: Reserved Box for Startup Story */}
          <div className="w-full md:w-[420px] shrink-0 text-left">
            <div className="glass-panel border border-gold/25 rounded-md p-8 relative overflow-hidden space-y-6 shadow-2xl bg-dark-surface/40">
              {/* Top accent highlight */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-gold/50 via-gold-accent to-gold/50"></div>
              
              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-[0.3em] text-gold uppercase block">
                  {t.heroStoryLabel}
                </span>
                <h3 className="font-serif text-2xl text-white font-light tracking-wider">
                  {t.heroStoryTitle}
                </h3>
              </div>
              
              <p className="font-sans text-xs text-[#eaeaea]/70 leading-relaxed font-light">
                {t.heroStoryDesc}
              </p>
              
              <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                <span className="text-[9px] font-mono text-gold-accent/40 uppercase tracking-widest">{t.heroStoryFooter}</span>
                <div className="w-2 h-2 rounded-full bg-gold/60 animate-pulse"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Product Showroom Stage */}
        <section id="showroom" className="max-w-4xl mx-auto px-6 py-24 space-y-36">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{t.catalogLabel}</span>
            <h2 className="font-serif text-3xl md:text-5xl font-light text-white uppercase tracking-wider">
              {t.catalogTitle}
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
                      {t.products[String(product.id)]?.name || product.name}
                    </h3>
                    <div className="w-12 h-[1px] bg-gold/30 mx-auto"></div>
                    <button
                      onClick={() => handleOpenDetail(product)}
                      className="font-serif text-xs tracking-[0.2em] border border-gold/40 text-gold hover:bg-gold hover:text-dark-bg transition-all duration-300 font-semibold py-3.5 px-10 rounded-sm uppercase cursor-pointer"
                    >
                      {t.viewMore}
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

      {/* PayOS Redirect Status Modal */}
      {renderRedirectStatusModal()}

      {/* Footer */}
      <footer id="about" className="border-t border-white/5 py-12 px-6 md:px-12 bg-dark-bg/60 text-center space-y-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase">
            OCOPIA HERITAGE
          </span>
          <p className="font-sans text-xs text-[#eaeaea]/55 leading-relaxed font-light">
            {t.footerCopyright}
          </p>
        </div>
      </footer>
    </div>
  );
}