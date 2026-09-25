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

interface CartItem {
  product: Product;
  quantity: number;
  selected: boolean;
}

export default function Home({ initialView = "home" }: { initialView?: "home" | "products" | "cart" } = {}) {
  const [currentView, setCurrentView] = useState<"home" | "products" | "cart">(initialView);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lang, setLang] = useState<"vi" | "en">("vi");
  const [isDark, setIsDark] = useState<boolean>(true);

  const navigateTo = (view: "home" | "products" | "cart") => {
    setCurrentView(view);
    setActiveDetailProduct(null);
    window.scrollTo(0, 0);
    if (typeof window !== "undefined") {
      const targetUrl = view === "products" ? "/products" : view === "cart" ? "/cart" : "/";
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ view }, "", targetUrl);
      }
    }
  };

  // Load language and theme preference from localStorage on mount + route sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/products") {
        setCurrentView("products");
      } else if (window.location.pathname === "/cart") {
        setCurrentView("cart");
      }
      const handlePopState = () => {
        if (window.location.pathname === "/products") {
          setCurrentView("products");
        } else if (window.location.pathname === "/cart") {
          setCurrentView("cart");
        } else {
          setCurrentView("home");
        }
      };
      window.addEventListener("popstate", handlePopState);

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

      return () => window.removeEventListener("popstate", handlePopState);
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
  const [selectedDetailImage, setSelectedDetailImage] = useState<string | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);

  const handleOpenDetail = (product: Product) => {
    setSavedScrollPosition(window.scrollY);
    setActiveDetailProduct(product);
    setSelectedDetailImage(product.image_url);
    setDetailQuantity(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Cart State & Persistent Storage
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [checkoutItems, setCheckoutItems] = useState<{ product: Product; quantity: number }[]>([]);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("ocopia_cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    } catch (e) {
      console.error("Failed to load cart from localStorage", e);
    }
  }, []);

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem("ocopia_cart", JSON.stringify(newCart));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  };

  const handleAddToCart = (product: Product, qty: number = 1) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    let newCart: CartItem[];
    if (existingIndex > -1) {
      newCart = cart.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + qty } : item
      );
    } else {
      newCart = [...cart, { product, quantity: qty, selected: true }];
    }
    updateCart(newCart);
    setCartToast(t.addedToCartToast || (lang === "vi" ? "Đã thêm vào giỏ hàng thành công!" : "Added to cart successfully!"));
    setTimeout(() => {
      setCartToast(null);
    }, 2800);
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const selectedCartItems = cart.filter((item) => item.selected);
  const selectedTotalAmount = selectedCartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const selectedTotalCount = selectedCartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const isAllSelected = cart.length > 0 && cart.every((item) => item.selected);

  const toggleSelectAll = () => {
    const nextState = !isAllSelected;
    updateCart(cart.map((item) => ({ ...item, selected: nextState })));
  };

  const toggleSelectItem = (productId: number) => {
    updateCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const updateItemQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      updateCart(cart.filter((item) => item.product.id !== productId));
    } else {
      updateCart(
        cart.map((item) =>
          item.product.id === productId ? { ...item, quantity: newQty } : item
        )
      );
    }
  };

  const removeItem = (productId: number) => {
    updateCart(cart.filter((item) => item.product.id !== productId));
  };

  const removeSelectedItems = () => {
    updateCart(cart.filter((item) => !item.selected));
  };

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

  // Hero Slider & Navbar State (Langfarm Style)
  const [currentSlide, setCurrentSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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

  // Static fallback products - hiển thị khi DB rỗng hoặc offline
  const STATIC_PRODUCTS: Product[] = [
    {
      id: 1,
      name: "Bánh Khô Mè Cẩm Lệ",
      price: 75000,
      image_url: "/kho_me.jpg",
      story: `Không phải ngẫu nhiên mà Bánh khô mè Cẩm Lệ từng là thức quà quý dâng lên bậc vương giả. Nằm ép mình bên bờ sông Cẩm Lệ êm đềm, những nghệ nhân làng nghề vẫn ngày đêm giữ lửa mẻ nướng, tráng từng lớp nếp thơm, phủ lên lớp áo mè vàng óng ánh như tơ. Người thợ già trong làng thường bảo: "Làm bánh khô mè là đang tu tâm". Để ra được một chiếc bánh xốp giòn, vỡ tan trong miệng, hạt nếp phải được rang trên cát mịn lấy từ dòng sông quê, tắm qua lớp đường mía ngọt thanh và áo một lớp mè rang củi thơm lừng. Bẻ một miếng bánh, nhấp một ngụm trà xanh, bạn không chỉ nếm được vị ngọt bùi, mà còn nghe thấy cả tiếng thời gian đọng lại trong từng lớp nếp nướng.`,
    },
    {
      id: 2,
      name: "Mực Rim Me Đà Nẵng",
      price: 85000,
      image_url: "/muc_rim.jpg",
      story: `Vị mặn mòi của nắng gió miền Trung, hòa quyện cùng lớp xốt me chua ngọt sánh mịn, điểm xuyết chút ớt xào cay tê... Chỉ cần mở nắp hộp, hương thơm lừng lẫy đã đủ sức đánh gục mọi tín đồ sành ăn nhất. Những mẻ mực lá tươi rói vừa cập bến cảng Thọ Quang lúc hừng đông được các dì, các mẹ chọn lọc kỹ càng, đem phơi đúng "một nắng" gắt để giữ trọn độ dai giòn, ngọt thịt. Linh hồn của món ăn nằm ở chảo xốt me kẹo lại trên bếp lửa liu riu suốt 4 giờ đồng hồ. Mực quyện xốt, xốt bám mực, đỏ au, bóng bẩy. Không cần sơn hào hải vị, một hộp mực rim me nhâm nhi cùng bạn bè những chiều tan tầm là đủ để gói gọn cả nhịp sống sôi động của phố biển Đà Nẵng.`,
    },
  ];

  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("id", { ascending: true });

        if (error) throw error;
        // Nếu DB rỗng (bị pause/restore), dùng static data làm fallback
        if (!data || data.length === 0) {
          setProducts(STATIC_PRODUCTS);
        } else {
          setProducts(data);
        }
      } catch (err: any) {
        console.error(err);
        // Lỗi kết nối → vẫn hiển thị sản phẩm từ static data
        setProducts(STATIC_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCheckout = (product: Product, qty: number = 1) => {
    setActiveProduct(product);
    setQuantity(qty);
    setCheckoutItems([{ product, quantity: qty }]);
    setPaymentMethod("cod");
    setFormData({ customerName: "", phone: "", address: "" });
    setIsCheckoutOpen(true);
    setIsSuccess(false);
    setCreatedOrderId("");
  };

  const openCartCheckout = () => {
    if (selectedCartItems.length === 0) {
      alert(t.selectAtLeastOne || (lang === "vi" ? "Vui lòng chọn ít nhất 1 sản phẩm để thanh toán." : "Please select at least 1 item to proceed to checkout."));
      return;
    }
    setActiveProduct(selectedCartItems[0].product);
    setQuantity(selectedTotalCount);
    setCheckoutItems(
      selectedCartItems.map((item) => ({ product: item.product, quantity: item.quantity }))
    );
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
      const currentOrderTotal = checkoutItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );
      const totalPrice = currentOrderTotal > 0 ? currentOrderTotal : (activeProduct.price * quantity);
      const orderStatus = paymentMethod === "cod" ? "COD_CONFIRMED" : "Pending";
      const checkoutTitle =
        checkoutItems.length === 1
          ? (t.products?.[String(checkoutItems[0].product.id)]?.name || checkoutItems[0].product.name)
          : `${t.products?.[String(checkoutItems[0].product.id)]?.name || checkoutItems[0].product.name} + ${checkoutItems.length - 1} ${lang === "vi" ? "sản phẩm khác" : "other items"}`;

      const itemsList = checkoutItems.length > 0
        ? checkoutItems
        : [{ product: activeProduct, quantity }];

      const itemsSummary = itemsList
        .map(
          (item) =>
            `${item.quantity}x ${item.product.name} (${(item.product.price * item.quantity).toLocaleString("vi-VN")}đ)`
        )
        .join(", ");

      const primaryProductId = itemsList[0]?.product?.id || null;
      const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace("T", " ").replace("Z", "");

      const orderPayload: Record<string, any> = {
        customer_name: formData.customerName,
        phone: formData.phone,
        address: formData.address,
        total_price: totalPrice,
        payment_method: paymentMethod.toUpperCase(),
        status: orderStatus,
        product_id: primaryProductId,
        items: itemsSummary,
        created_at: vnNow,
        updated_at: vnNow,
      };

      let insertResult = await supabase.from("orders").insert(orderPayload).select();

      // Nếu cột 'items' chưa được tạo trong Supabase (PGRST204), tự động fallback lưu không có 'items'
      if (insertResult.error && insertResult.error.code === "PGRST204") {
        delete orderPayload.items;
        insertResult = await supabase.from("orders").insert(orderPayload).select();
      }

      if (insertResult.error) throw insertResult.error;

      const insertedOrder = insertResult.data?.[0];
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
            productName: checkoutTitle,
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
          // Remove purchased items from cart
          if (checkoutItems.length > 0) {
            const checkedIds = checkoutItems.map((ci) => ci.product.id);
            updateCart(cart.filter((item) => !checkedIds.includes(item.product.id)));
          }
        } else {
          throw new Error(checkoutData.error || "Không thể khởi tạo cổng thanh toán PayOS.");
        }
      } else {
        // COD: insert vào bảng completed_orders
        const completedPayload: Record<string, any> = {
          order_id: insertedOrder?.id,
          customer_name: formData.customerName,
          phone: formData.phone,
          address: formData.address,
          total_price: totalPrice,
          payment_method: "COD",
          status: "COD_CONFIRMED",
          items: itemsSummary,
          created_at: vnNow,
        };

        let compRes = await supabase.from("completed_orders").insert(completedPayload);
        if (compRes.error && compRes.error.code === "PGRST204") {
          delete completedPayload.items;
          compRes = await supabase.from("completed_orders").insert(completedPayload);
        }

        if (compRes.error) {
          console.error("Lỗi khi lưu đơn COD vào completed_orders:", compRes.error);
        } else {
          console.log(`Đơn hàng COD #${insertedOrder?.id} đã được lưu vào completed_orders.`);
        }

        // Remove purchased items from cart
        if (checkoutItems.length > 0) {
          const checkedIds = checkoutItems.map((ci) => ci.product.id);
          updateCart(cart.filter((item) => !checkedIds.includes(item.product.id)));
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
                    <span className="text-xs font-medium text-white text-right max-w-[70%]">
                      {checkoutItems.map((ci) => `${t.products?.[String(ci.product.id)]?.name || ci.product.name} (x${ci.quantity})`).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2">
                    <span className="text-sm font-bold text-gold-light">{t.labelTotal}</span>
                    <span className="text-sm font-bold text-gold-light font-serif">
                      {checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("vi-VN")} VNĐ
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
                        src={`https://img.vietqr.io/image/MB-123456789-compact2.png?amount=${checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)}&addInfo=${createdOrderId}&accountName=DANG%20XUAN%20HUNG`}
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
                    className="w-full font-serif text-xs tracking-widest bg-gold text-dark-bg font-semibold py-3 px-8 rounded-sm hover:bg-gold-light transition-colors cursor-pointer"
                  >
                    {t.doneBtn}
                  </button>
                </div>
              </div>
            ) : (
              /* Checkout Form View */
              <form onSubmit={handleSubmitOrder} className="space-y-6">
                {/* Selected Products Summary Cards */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {checkoutItems.map((ci, idx) => (
                    <div key={idx} className="flex gap-3 p-3 border border-white/5 rounded-sm bg-white/[0.01] items-center">
                      <img
                        src={ci.product.image_url}
                        alt={ci.product.name}
                        className="w-14 h-14 object-cover rounded border border-white/5 shrink-0"
                      />
                      <div className="flex-grow min-w-0">
                        <h4 className="font-serif text-sm text-white truncate">
                          {t.products?.[String(ci.product.id)]?.name || ci.product.name}
                        </h4>
                        <p className="text-xs text-gold-accent font-serif mt-0.5">
                          {ci.product.price.toLocaleString("vi-VN")} VNĐ x {ci.quantity}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-serif text-sm text-gold font-bold">
                          {(ci.product.price * ci.quantity).toLocaleString("vi-VN")} VNĐ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center px-1 pt-1 border-t border-white/5">
                  <span className="text-xs text-[#eaeaea]/50 uppercase tracking-widest">{t.subtotal}</span>
                  <span className="font-serif text-lg text-gold font-bold">
                    {checkoutItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString("vi-VN")} VNĐ
                  </span>
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
    const localizedProduct = t.products?.[String(activeDetailProduct.id)];
    const isCamLe = activeDetailProduct.id === 1;

    // Gallery images
    const galleryImages = isCamLe
      ? ["/kho_me.jpg", "/g_banh_me_tea.jpg", "/g_nep_huong.jpg", "/g_me_rang.jpg"]
      : ["/muc_rim.jpg", "/muc_close_up.jpg", "/g_muc_rim_lifestyle.jpg", "/g_muc_kho.jpg"];

    const currentImg = selectedDetailImage || activeDetailProduct.image_url;

    // Tagline (under title)
    const productTagline = isCamLe
      ? (lang === "vi"
          ? "Bánh to xốp giòn, thơm nức mè rang củi, 1 bánh cho 1 tách trà chuẩn vị cung đình"
          : "Crispy imperial sesame cake, wood-roasted sesame aroma, crafted for royal tea ceremonies")
      : (lang === "vi"
          ? "Mực ống tươi dày thịt quyện sốt me cốt chua cay đậm đà, chuẩn vị biển miền Trung"
          : "Fresh thick Da Nang squid glazed in tangy sweet-and-sour tamarind sauce");

    // Key Highlights (Image 2: Đặc tính nổi bật)
    const highlights = isCamLe
      ? (lang === "vi"
          ? [
              "Bánh khô mè Cẩm Lệ Ocopia được chế biến từ nguyên liệu nguồn gốc nông sản tự nhiên, thơm ngon, đậm đà phong vị Đà thành.",
              "Bánh to xốp giòn, thơm nức mè rang củi, 1 bánh cho 1 tách trà ấm với sự hòa quyện giữa mật mía ngọt thanh và gừng cay ấm.",
              "Nhà xưởng đạt chuẩn an toàn vệ sinh thực phẩm, gìn giữ công thức ẩm thực truyền thống danh tiếng từng tiến vua triều Nguyễn.",
              "Bao bì hộp quà trang trọng, chỉn chu, thích hợp tiêu dùng hàng ngày hoặc làm quà biếu đặc sản ý nghĩa.",
            ]
          : [
              "Ocopia Cam Le Sesame Cake is crafted from authentic local ingredients: fragrant sticky rice, wood-roasted sesame, and ginger.",
              "Crispy, light and aromatic, perfectly paired with a hot cup of Vietnamese green tea.",
              "Certified food safety production, preserving the centuries-old royal recipe once presented to the Nguyen Dynasty court.",
              "Elegant packaging, perfect for daily enjoyment or gifting authentic Vietnamese heritage.",
            ])
      : (lang === "vi"
          ? [
              "Mực rim me Đà Nẵng Ocopia sử dụng 100% mực ống tươi vùng biển Đà Nẵng, thịt dày, dai giòn tự nhiên.",
              "Sốt me chín cô đặc rim nhỏ lửa suốt 4 giờ cùng ớt xiêm cay nồng và tỏi thơm, mang lại vị chua cay mặn ngọt bùng nổ giác quan.",
              "Cơ sở chế biến đạt chứng nhận OCOP 3 sao và chuẩn an toàn vệ sinh thực phẩm, không phẩm màu độc hại.",
              "Đóng hũ PET nắp nhôm màng seal kín hiện đại, thẩm mỹ, sạch sẽ, bảo quản tối ưu độ tươi giòn của mực.",
            ]
          : [
              "Crafted with 100% fresh squid harvested from Da Nang waters, naturally chewy and savory.",
              "Simmered slowly for 4 hours in pure tamarind glaze, chili and local garlic for a burst of sweet-sour-spicy flavor.",
              "OCOP 3-star certified production facility meeting strict food safety and hygiene regulations.",
              "Convenient PET jar with hermetic seal preserving crisp freshness and flavor.",
            ]);

    // Specifications (Image 2: Thông tin sản phẩm)
    const specs = isCamLe
      ? (lang === "vi"
          ? [
              { label: "Tên sản phẩm", value: "Bánh khô mè Cẩm Lệ, 250g, hộp, đặc sản Ocopia Heritage" },
              { label: "Thương hiệu", value: "Ocopia Heritage" },
              { label: "Mã vạch / Mã chứng nhận", value: "OCOP-4STAR-DN-2026" },
              { label: "Khối lượng tịnh / Thể tích thực", value: "250g" },
              { label: "Hạn sử dụng", value: "6 tháng kể từ ngày sản xuất" },
              { label: "Thành phần", value: "Nếp hương Bầu (45%), mè trắng rang củi (25%), mật mía Điện Bàn (20%), gừng sẻ tươi (8%), đường cát, muối tinh." },
              { label: "Hướng dẫn sử dụng", value: "Thực phẩm ăn liền không qua chế biến. Sử dụng ngay sau khi mở bao bì, ngon nhất khi thưởng thức cùng trà ấm." },
              { label: "Hướng dẫn bảo quản", value: "Bảo quản nơi khô ráo, thoáng mát, đậy kín sau khi mở, tránh xa ánh nắng trực tiếp." },
              { label: "Thông tin cảnh báo", value: "Không sử dụng khi có hiện tượng ẩm mốc, mùi vị lạ. Sản phẩm có chứa gói hút oxy bên trong." },
              { label: "Chất gây dị ứng", value: "Sản phẩm có chứa mè (vừng) và nếp." },
              { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP 4 Sao TP. Đà Nẵng, Giấy chứng nhận ATVSTP số 08/2024/ATTP-ĐN" },
            ]
          : [
              { label: "Product Name", value: "Cam Le Crispy Sesame Cake, 250g box, Ocopia Heritage" },
              { label: "Brand", value: "Ocopia Heritage" },
              { label: "Barcode / Certification", value: "OCOP-4STAR-DN-2026" },
              { label: "Net Weight", value: "250g" },
              { label: "Shelf Life", value: "6 months from manufacture date" },
              { label: "Ingredients", value: "Fragrant sticky rice (45%), wood-roasted sesame (25%), cane sugar (20%), fresh ginger (8%), salt." },
              { label: "Usage Instructions", value: "Ready to eat. Consume immediately after opening, best paired with warm tea." },
              { label: "Storage", value: "Store in a cool, dry place away from direct sunlight. Reseal tightly after opening." },
              { label: "Warning", value: "Do not use if moldy or past expiration date. Do not eat the desiccant packet." },
              { label: "Allergen Info", value: "Contains sesame and glutinous rice." },
              { label: "Certification", value: "Da Nang OCOP 4-Star Certified, Food Hygiene Safety Certificate." },
            ])
      : (lang === "vi"
          ? [
              { label: "Tên sản phẩm", value: "Mực rim me chua cay Đà Nẵng, 250g, hũ, đặc sản Ocopia Heritage" },
              { label: "Thương hiệu", value: "Ocopia Heritage" },
              { label: "Mã vạch / Mã chứng nhận", value: "OCOP-3STAR-DN-2026" },
              { label: "Khối lượng tịnh / Thể tích thực", value: "250g" },
              { label: "Hạn sử dụng", value: "6 tháng kể từ ngày sản xuất" },
              { label: "Thành phần", value: "Mực ống phơi khô (65%), xốt me chín tự nhiên (20%), đường mía (8%), ớt tươi cay nồng, tỏi Lý Sơn, nước mắm truyền thống, dầu thực vật." },
              { label: "Hướng dẫn sử dụng", value: "Thực phẩm ăn liền không qua chế biến. Dùng ngay sau khi mở nắp, thích hợp làm món ăn vặt hoặc nhắm cùng tri kỷ." },
              { label: "Hướng dẫn bảo quản", value: "Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp. Đậy kín nắp sau khi mở (bảo quản ngăn mát tủ lạnh để mực giữ độ giòn ngon nhất)." },
              { label: "Thông tin cảnh báo", value: "Không sử dụng khi có hiện tượng mốc hoặc đổi màu lạ." },
              { label: "Chất gây dị ứng", value: "Sản phẩm có chứa hải sản (mực)." },
              { label: "Tiêu chuẩn chất lượng", value: "Chứng nhận OCOP 3 Sao TP. Đà Nẵng, Giấy chứng nhận ATVSTP số 12/2024/ATTP-ĐN" },
            ]
          : [
              { label: "Product Name", value: "Da Nang Tamarind Glazed Squid, 250g jar, Ocopia Heritage" },
              { label: "Brand", value: "Ocopia Heritage" },
              { label: "Barcode / Certification", value: "OCOP-3STAR-DN-2026" },
              { label: "Net Weight", value: "250g" },
              { label: "Shelf Life", value: "6 months from manufacture date" },
              { label: "Ingredients", value: "Sun-dried squid (65%), natural ripe tamarind sauce (20%), cane sugar (8%), fresh chili, garlic, fish sauce, vegetable oil." },
              { label: "Usage Instructions", value: "Ready to eat directly. Best enjoyed as a savory snack or appetizer." },
              { label: "Storage", value: "Keep in a cool, dry place. Reseal tightly after opening. Chilled storage recommended." },
              { label: "Warning", value: "Do not consume if packaging is damaged or if product shows unusual discoloration." },
              { label: "Allergen Info", value: "Contains seafood (squid)." },
              { label: "Certification", value: "Da Nang OCOP 3-Star Certified, Food Hygiene Safety Certificate." },
            ]);

    // Related products (Image 3: Sản phẩm bạn có thể thích)
    const relatedProducts = products.filter((p) => p.id !== activeDetailProduct.id);

    return (
      <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
        {/* Background Decorative Blur Lines */}
        <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
        <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

        {/* Top Announcement Bar */}
        <aside className="w-full bg-[#18140c] text-gold-light/95 border-b border-gold/20 py-2 px-4 text-xs font-sans tracking-wide">
          <div className="max-w-7xl mx-auto text-center font-medium truncate">
            <span>{t.topBarText || "SIÊU ƯU ĐÃI NÔNG SẢN VIỆT - MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC CHO ĐƠN TỪ 200.000Đ"}</span>
          </div>
        </aside>

        {/* Header */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-3.5 px-4 md:px-12 flex items-center justify-between gap-4">
          <div
            onClick={() => {
              handleCloseDetail();
              navigateTo("home");
            }}
            className="flex items-center gap-3 group shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gold/40 shadow-sm p-0.5 bg-dark-bg/60 group-hover:border-gold transition-colors">
              <img
                src="/background.jpg"
                alt="Ocopia Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.2em] gold-gradient-text uppercase leading-none">
                  Ocopia
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest bg-gold/10 text-gold-accent border border-gold/20 px-1.5 py-0.5 rounded hidden sm:inline-block">
                  Heritage
                </span>
              </div>
              <span className="text-[9px] font-sans text-[#eaeaea]/50 tracking-wider hidden md:block">
                {lang === "vi" ? "Đặc sản OCOP Việt Nam" : "Vietnamese OCOP Heritage"}
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-serif text-xs tracking-[0.18em] uppercase">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("products");
              }}
              className="text-gold font-bold border-b-2 border-gold transition-all duration-300 cursor-pointer py-1"
            >
              {t.navProducts || "SẢN PHẨM"}
            </button>
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("home");
                setTimeout(() => {
                  const el = document.getElementById("about");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-[#eaeaea]/85 hover:text-gold transition-colors font-medium cursor-pointer py-1"
            >
              {t.navStory || "CÂU CHUYỆN"}
            </button>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("cart");
              }}
              className="relative p-2 text-gold hover:text-gold-light transition-colors rounded-full hover:bg-gold/5 cursor-pointer"
              aria-label="Shopping Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute top-0.5 right-0.5 bg-gold text-dark-bg text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono shadow-sm">
                {totalCartCount}
              </span>
            </button>

            <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>

            <button
              onClick={toggleTheme}
              className="text-gold hover:text-gold-light transition-colors p-1"
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={toggleLang}
              className="font-serif text-[11px] font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-0.5"
              aria-label="Toggle language"
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </div>
        </header>

        {/* Breadcrumb Navigation */}
        <div className="border-b border-white/5 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-3.5 text-xs font-sans text-[#eaeaea]/60 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("home");
              }}
              className="hover:text-gold transition-colors cursor-pointer"
            >
              {lang === "vi" ? "Trang chủ" : "Home"}
            </button>
            <span className="text-[#eaeaea]/30">•</span>
            <button
              onClick={() => {
                handleCloseDetail();
                navigateTo("products");
              }}
              className="hover:text-gold transition-colors cursor-pointer"
            >
              {lang === "vi" ? "Tất cả sản phẩm" : "All Products"}
            </button>
            <span className="text-[#eaeaea]/30">•</span>
            <span className="text-gold-accent font-medium">
              {isCamLe 
                ? (lang === "vi" ? "Bánh mứt đặc sản" : "Specialty Confectionery")
                : (lang === "vi" ? "Hải sản đặc sản" : "Seafood Delicacies")}
            </span>
            <span className="text-[#eaeaea]/30">•</span>
            <span className="text-white font-medium truncate max-w-[220px] sm:max-w-none">
              {localizedProduct?.name || activeDetailProduct.name}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-grow z-10 w-full">
          {/* IMAGE 1: PRODUCT SHOWCASE & BUY BOX */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8 md:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
              {/* Left Column: Main Image + Thumbnails */}
              <div className="lg:col-span-6 space-y-4">
                {/* Main Large Image */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl bg-white/[0.02]">
                  <img
                    src={currentImg}
                    alt={activeDetailProduct.name}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                  {/* OCOP Star Badge */}
                  <div className="absolute top-4 left-4 bg-gold text-dark-bg font-mono font-bold text-xs tracking-wider uppercase px-3 py-1 rounded-full shadow-lg border border-gold-light/40">
                    {isCamLe ? "OCOP 4★" : "OCOP 3★"}
                  </div>
                </div>

                {/* Thumbnails Row */}
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {galleryImages.map((thumbUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDetailImage(thumbUrl)}
                      className={`relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden border transition-all duration-200 shrink-0 cursor-pointer ${
                        currentImg === thumbUrl
                          ? "border-gold ring-2 ring-gold/40 shadow-lg shadow-gold/10 scale-102"
                          : "border-white/10 opacity-70 hover:opacity-100 hover:border-white/30"
                      }`}
                    >
                      <img
                        src={thumbUrl}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Product Info & Purchase Options */}
              <div className="lg:col-span-6 space-y-6 text-left">
                {/* Brand line */}
                <div className="text-xs uppercase tracking-widest text-[#eaeaea]/60 font-sans">
                  {lang === "vi" ? "Thương hiệu " : "Brand "}
                  <span className="text-gold font-bold tracking-wider">Ocopia Heritage</span>
                </div>

                {/* Product Title */}
                <div className="space-y-2">
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-white font-bold leading-tight tracking-wide">
                    {localizedProduct?.name || activeDetailProduct.name}
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/70 font-light leading-relaxed">
                    {productTagline}
                  </p>
                </div>

                {/* Badge Tag */}
                <div>
                  <span className="inline-block bg-gold text-dark-bg font-sans font-bold text-[11px] tracking-wider uppercase px-3 py-1 rounded-full shadow-sm">
                    {isCamLe
                      ? (lang === "vi" ? "Bán chạy" : "Best Seller")
                      : (lang === "vi" ? "Đặc sản Đà Nẵng" : "Da Nang Specialty")}
                  </span>
                </div>

                {/* Mẫu & KLT */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <span className="text-xs font-semibold text-[#eaeaea]/70 tracking-wider block font-sans">
                    {lang === "vi" ? "Mẫu & KLT" : "Packaging & Weight"}
                  </span>
                  <div className="inline-flex items-center px-4 py-1.5 rounded-lg border border-gold bg-gold/10 text-gold font-serif text-xs sm:text-sm font-semibold tracking-wide shadow-sm">
                    {isCamLe
                      ? (lang === "vi" ? "Hộp 250g" : "250g Box")
                      : (lang === "vi" ? "Hũ 250g" : "250g Jar")}
                  </div>
                </div>

                {/* Price */}
                <div className="pt-1">
                  <span className="font-serif text-3xl sm:text-4xl font-bold text-gold">
                    {activeDetailProduct.price.toLocaleString("vi-VN")} VNĐ
                  </span>
                </div>

                {/* Quantity + Buy Button */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-[#eaeaea]/60 block font-light">
                    {lang === "vi" ? "Thêm số lượng" : "Select quantity"}
                  </span>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Quantity counter */}
                    <div className="flex items-center border border-gold/40 hover:border-gold rounded-lg overflow-hidden glass-panel shadow-sm">
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))}
                        className="px-4 py-2.5 text-white hover:text-gold hover:bg-gold/15 text-lg font-bold transition-colors cursor-pointer select-none"
                        aria-label="Giảm số lượng"
                      >
                        -
                      </button>
                      <span className="px-4 py-2.5 font-mono text-base font-bold text-white min-w-[3rem] text-center select-none">
                        {detailQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(detailQuantity + 1)}
                        className="px-4 py-2.5 text-white hover:text-gold hover:bg-gold/15 text-lg font-bold transition-colors cursor-pointer select-none"
                        aria-label="Tăng số lượng"
                      >
                        +
                      </button>
                    </div>

                    {/* Action Buttons: Thêm vào giỏ hàng & Mua ngay */}
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                      {/* Button 1: Thêm vào giỏ hàng */}
                      <button
                        type="button"
                        onClick={() => handleAddToCart(activeDetailProduct, detailQuantity)}
                        className="flex-1 font-serif text-xs sm:text-sm tracking-wider border-2 border-gold/70 hover:border-gold text-gold hover:bg-gold/10 font-bold py-3.5 px-4 rounded-lg uppercase shadow-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer select-none"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span>{t.addToCartBtn || (lang === "vi" ? "Thêm vào giỏ hàng" : "Add to Cart")}</span>
                      </button>

                      {/* Button 2: Mua ngay */}
                      <button
                        type="button"
                        onClick={() => openCheckout(activeDetailProduct, detailQuantity)}
                        className="flex-1 font-serif text-xs sm:text-sm tracking-wider bg-gold hover:bg-gold-light text-dark-bg font-bold py-3.5 px-6 rounded-lg uppercase shadow-xl shadow-gold/15 transition-all duration-300 transform active:scale-[0.98] cursor-pointer flex items-center justify-center select-none"
                      >
                        {t.buyNowBtn || (lang === "vi" ? "Mua ngay" : "Buy Now")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 Trust & Policy Cards (2x2 grid matching Image 1) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t border-white/10">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a2 2 0 100-4 2 2 0 000 4zm8 0a2 2 0 100-4 2 2 0 000 4m-12-6h13l3 4v5H4v-9zM4 11V6a2 2 0 012-2h8a2 2 0 012 2v5" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Miễn phí vận chuyển" : "Free shipping"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Đơn hàng từ 200.000đ" : "Orders from 200k"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Giao hàng nhanh" : "Fast delivery"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Toàn quốc 2 - 3 ngày" : "Nationwide 2-3 days"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Mua nhanh tiện lợi" : "Quick checkout"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "Chỉ cần số điện thoại" : "With phone number only"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 rounded-xl glass-panel border border-white/5 bg-white/[0.02]">
                    <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-left space-y-0.5">
                      <p className="text-xs font-semibold text-white">
                        {lang === "vi" ? "Bản sắc OCOP" : "OCOP Heritage"}
                      </p>
                      <p className="text-[11px] text-[#eaeaea]/60 font-light">
                        {lang === "vi" ? "100% nông sản bản địa" : "100% local ingredients"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* IMAGE 2: PRODUCT HIGHLIGHTS & DETAILED SPECIFICATIONS */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 md:py-16 border-t border-white/10 text-left space-y-12">
            {/* Heading repeat */}
            <div className="space-y-1 pb-2">
              <h2 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-wide">
                {localizedProduct?.name || activeDetailProduct.name}
              </h2>
              <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light">
                {productTagline}
              </p>
            </div>

            {/* Section 1: Đặc tính nổi bật */}
            <div className="space-y-5">
              <h3 className="font-serif text-xl sm:text-2xl text-white font-bold tracking-wide border-b border-white/10 pb-3">
                {lang === "vi" ? "Đặc tính nổi bật" : "Key Highlights"}
              </h3>
              <ul className="space-y-3 font-sans text-xs sm:text-sm text-[#eaeaea]/85 font-light list-disc pl-5 leading-relaxed">
                {highlights.map((item, idx) => (
                  <li key={idx} className="pl-1">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Section 2: Thông tin sản phẩm */}
            <div className="space-y-5 pt-4">
              <h3 className="font-serif text-xl sm:text-2xl text-white font-bold tracking-wide border-b border-white/10 pb-3">
                {lang === "vi" ? "Thông tin sản phẩm" : "Product Information"}
              </h3>
              <ul className="space-y-3 font-sans text-xs sm:text-sm text-[#eaeaea]/85 font-light list-disc pl-5 leading-relaxed">
                {specs.map((item, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="text-white font-medium">{item.label}: </span>
                    <span className="text-[#eaeaea]/85">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* IMAGE 3: SẢN PHẨM BẠN CÓ THỂ THÍCH */}
          {relatedProducts.length > 0 && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 md:py-16 border-t border-white/10 text-left space-y-8">
              <div className="space-y-1">
                <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-wide">
                  {lang === "vi" ? "Sản phẩm bạn có thể thích" : "You May Also Like"}
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {relatedProducts.map((relProduct) => {
                  const localizedRel = t.products?.[String(relProduct.id)];
                  return (
                    <div
                      key={relProduct.id}
                      onClick={() => handleOpenDetail(relProduct)}
                      className="group flex flex-col text-left cursor-pointer transition-all duration-300"
                    >
                      {/* Product Image */}
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 group-hover:border-gold/50 transition-all duration-300 shadow-md group-hover:shadow-2xl group-hover:shadow-gold/5">
                        <img
                          src={relProduct.image_url}
                          alt={relProduct.name}
                          className="w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-500"
                        />
                        <div className="absolute top-3 left-3 bg-gold text-dark-bg font-mono font-bold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-md border border-gold-light/40">
                          {relProduct.id === 1 ? "OCOP 4★" : "OCOP 3★"}
                        </div>
                        <div className="absolute inset-0 bg-dark-bg/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                          <span className="font-serif text-xs font-bold tracking-widest text-dark-bg bg-gold px-4 py-2 rounded-full uppercase shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {t.viewMore || "XEM CHI TIẾT"} →
                          </span>
                        </div>
                      </div>

                      {/* Product Info below image */}
                      <div className="pt-3 space-y-1">
                        <h4 className="font-serif text-base sm:text-lg font-medium text-white group-hover:text-gold transition-colors line-clamp-2 leading-snug">
                          {localizedRel?.name || relProduct.name}
                        </h4>
                        <p className="font-sans text-xs text-[#eaeaea]/50 font-light line-clamp-1">
                          {relProduct.id === 1
                            ? (lang === "vi" ? "Hộp 250g" : "250g Box")
                            : (lang === "vi" ? "Hũ 250g" : "250g Jar")}
                        </p>
                        <p className="font-serif text-base sm:text-lg font-bold text-gold pt-0.5">
                          {relProduct.price.toLocaleString("vi-VN")} VNĐ
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        {/* Checkout Modal */}
        {renderCheckoutModal()}

        {/* PayOS Redirect Status Modal */}
        {renderRedirectStatusModal()}

        {/* Footer */}
        <footer id="about" className="border-t border-white/5 py-10 px-6 md:px-12 bg-dark-bg/60 text-center">
          <div className="max-w-2xl mx-auto space-y-2">
            <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold block">
              OCOPIA HERITAGE
            </span>
            <p className="font-mono text-xs sm:text-sm text-gold-accent tracking-widest">
              {lang === "vi" ? "Liên hệ" : "Hotline"}: 0787755835
            </p>
          </div>
        </footer>

        {/* Toast Notification */}
        {cartToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl glass-panel border border-gold/50 bg-[#14151a]/95 text-white shadow-2xl animate-fade-in-up">
            <div className="w-7 h-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center text-gold shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-sans text-xs sm:text-sm font-medium">{cartToast}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden font-sans">
      {/* Background Decorative Blur Lines */}
      <div className="absolute top-[20%] left-[-10%] w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[30%] right-[-10%] w-[600px] h-[600px] bg-gold-accent/5 rounded-full blur-[150px] pointer-events-none"></div>

      {/* Top Announcement Bar */}
      <aside className="w-full bg-[#18140c] text-gold-light/95 border-b border-gold/20 py-2 px-4 text-xs font-sans tracking-wide">
        <div className="max-w-7xl mx-auto text-center font-medium truncate">
          <span>{t.topBarText || "SIÊU ƯU ĐÃI NÔNG SẢN VIỆT - MIỄN PHÍ VẬN CHUYỂN TOÀN QUỐC CHO ĐƠN TỪ 200.000Đ"}</span>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/5 py-3.5 px-4 md:px-12 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <div
          onClick={() => navigateTo("home")}
          className="flex items-center gap-3 group shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-gold/40 shadow-sm p-0.5 bg-dark-bg/60 group-hover:border-gold transition-colors">
            <img
              src="/background.jpg"
              alt="Ocopia Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl sm:text-2xl font-bold tracking-[0.2em] gold-gradient-text uppercase leading-none">
                Ocopia
              </span>
              <span className="text-[9px] uppercase font-mono tracking-widest bg-gold/10 text-gold-accent border border-gold/20 px-1.5 py-0.5 rounded hidden sm:inline-block">
                Heritage
              </span>
            </div>
            <span className="text-[9px] font-sans text-[#eaeaea]/50 tracking-wider hidden md:block">
              {lang === "vi" ? "Đặc sản OCOP Việt Nam" : "Vietnamese OCOP Heritage"}
            </span>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 font-serif text-xs tracking-[0.18em] uppercase">
          <button
            onClick={() => navigateTo("products")}
            className={`transition-all duration-300 font-medium cursor-pointer py-1 ${
              currentView === "products"
                ? "text-gold font-bold border-b-2 border-gold"
                : "text-[#eaeaea]/85 hover:text-gold"
            }`}
          >
            {t.navProducts || "SẢN PHẨM"}
          </button>
          <button
            onClick={() => {
              if (currentView !== "home") {
                navigateTo("home");
                setTimeout(() => {
                  const el = document.getElementById("about");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 100);
              } else {
                const el = document.getElementById("about");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="text-[#eaeaea]/85 hover:text-gold transition-colors font-medium cursor-pointer py-1"
          >
            {t.navStory || "CÂU CHUYỆN"}
          </button>
        </nav>

        {/* Right: Actions (Cart, Theme & Lang) */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Cart Icon with Counter Badge */}
          <button
            onClick={() => navigateTo("cart")}
            className="relative p-2 text-gold hover:text-gold-light transition-colors rounded-full hover:bg-gold/5 cursor-pointer"
            aria-label="Shopping Cart"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="absolute top-0.5 right-0.5 bg-gold text-dark-bg text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center font-mono shadow-sm">
              {totalCartCount}
            </span>
          </button>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block"></div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="text-gold hover:text-gold-light transition-colors p-1"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="font-serif text-[11px] font-bold tracking-widest text-[#eaeaea]/85 hover:text-gold transition-colors border border-white/10 hover:border-gold/50 rounded px-2 py-0.5"
            aria-label="Toggle language"
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow z-10 w-full">
        {currentView === "cart" ? (
          /* CART PAGE VIEW (Shopee Style with Ocopia Heritage Elegance) */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-14 space-y-8 w-full flex-grow text-left">
            {/* Breadcrumb Navigation */}
            <div className="text-xs font-sans text-[#eaeaea]/60 flex items-center gap-2">
              <button
                onClick={() => navigateTo("home")}
                className="hover:text-gold transition-colors cursor-pointer"
              >
                {lang === "vi" ? "Trang chủ" : "Home"}
              </button>
              <span className="text-[#eaeaea]/30">•</span>
              <span className="text-white font-medium">
                {t.cartTitle || (lang === "vi" ? "Giỏ hàng của bạn" : "Your Shopping Cart")}
              </span>
            </div>

            {/* Header info: Title + Count */}
            <div className="border-b border-white/10 pb-6 flex items-baseline justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-light tracking-wide">
                  {t.cartTitle || (lang === "vi" ? "Giỏ hàng của bạn" : "Your Shopping Cart")}
                </h1>
                <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light">
                  {lang === "vi"
                    ? `(Tổng ${cart.length} món trong giỏ hàng)`
                    : `(${cart.length} items in your cart)`}
                </p>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTo("products")}
                  className="font-serif text-xs tracking-wider text-gold hover:text-gold-light border border-gold/30 hover:border-gold px-4 py-2 rounded-md transition-colors cursor-pointer uppercase"
                >
                  + {lang === "vi" ? "Chọn thêm sản phẩm khác" : "Add more products"}
                </button>
              )}
            </div>

            {/* Cart Body */}
            {cart.length === 0 ? (
              /* Empty Cart State */
              <div className="text-center py-20 px-4 space-y-6 glass-panel rounded-2xl border border-white/10 max-w-lg mx-auto bg-white/[0.01]">
                <div className="w-20 h-20 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto text-gold">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-2xl text-white">
                    {t.cartEmptyTitle || (lang === "vi" ? "Giỏ hàng của bạn đang trống" : "Your cart is currently empty")}
                  </h3>
                  <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 max-w-sm mx-auto leading-relaxed">
                    {t.cartEmptyDesc || (lang === "vi" ? "Hãy dạo quanh cửa hàng để khám phá những đặc sản OCOP truyền thống thơm thảo." : "Explore our authentic Vietnamese OCOP heritage specialties.")}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigateTo("products")}
                    className="font-serif text-xs sm:text-sm tracking-widest bg-gold hover:bg-gold-light text-dark-bg font-bold py-3.5 px-8 rounded-lg uppercase shadow-lg shadow-gold/10 transition-all cursor-pointer"
                  >
                    {t.continueShopping || (lang === "vi" ? "MUA SẮM NGAY" : "SHOP NOW")}
                  </button>
                </div>
              </div>
            ) : (
              /* Cart Items List + Shopee Style Checkout Bar */
              <div className="space-y-6">
                {/* Table Header (Desktop) */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 rounded-xl glass-panel border border-white/10 text-xs font-sans font-medium text-[#eaeaea]/70 items-center bg-white/[0.02]">
                  <div className="col-span-5 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="select-all-top"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer"
                    />
                    <label htmlFor="select-all-top" className="cursor-pointer select-none">
                      {t.selectAll || (lang === "vi" ? "Chọn tất cả" : "Select All")} ({cart.length})
                    </label>
                  </div>
                  <div className="col-span-2 text-center">{t.unitPriceLabel || (lang === "vi" ? "Đơn giá" : "Unit Price")}</div>
                  <div className="col-span-2 text-center">{t.quantity || (lang === "vi" ? "Số lượng" : "Quantity")}</div>
                  <div className="col-span-2 text-right">{t.subtotalLabel || (lang === "vi" ? "Số tiền" : "Subtotal")}</div>
                  <div className="col-span-1 text-center">{t.actionLabel || (lang === "vi" ? "Thao tác" : "Action")}</div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {cart.map((item) => {
                    const localized = t.products?.[String(item.product.id)];
                    const isCamLe = item.product.id === 1;
                    const itemSpec = isCamLe
                      ? (lang === "vi" ? "Hộp 250g" : "250g Box")
                      : (lang === "vi" ? "Hũ 250g" : "250g Jar");

                    return (
                      <div
                        key={item.product.id}
                        className={`p-4 sm:p-5 rounded-xl glass-panel border transition-all duration-300 ${
                          item.selected
                            ? "border-gold/40 bg-gold/[0.03]"
                            : "border-white/10 bg-white/[0.01]"
                        }`}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          {/* Checkbox + Product Info */}
                          <div className="col-span-1 md:col-span-5 flex items-center gap-3 sm:gap-4">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleSelectItem(item.product.id)}
                              className="w-5 h-5 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer shrink-0"
                            />
                            {/* Product thumbnail */}
                            <div
                              onClick={() => handleOpenDetail(item.product)}
                              className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden glass-panel border border-white/10 shrink-0 cursor-pointer hover:border-gold/50 transition-colors"
                            >
                              <img
                                src={item.product.image_url}
                                alt={item.product.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 left-1 bg-gold text-dark-bg font-mono font-bold text-[8px] uppercase px-1.5 py-0.2 rounded shadow-sm">
                                {isCamLe ? "4★" : "3★"}
                              </div>
                            </div>
                            {/* Title & specs */}
                            <div className="min-w-0 flex-1">
                              <h3
                                onClick={() => handleOpenDetail(item.product)}
                                className="font-serif text-sm sm:text-base font-semibold text-white hover:text-gold transition-colors cursor-pointer truncate"
                              >
                                {localized?.name || item.product.name}
                              </h3>
                              <p className="font-sans text-xs text-[#eaeaea]/50 mt-0.5">
                                {itemSpec}
                              </p>
                              {/* Mobile price indicator */}
                              <div className="md:hidden pt-1 font-serif text-sm font-bold text-gold">
                                {item.product.price.toLocaleString("vi-VN")} VNĐ
                              </div>
                            </div>
                          </div>

                          {/* Unit Price (Desktop) */}
                          <div className="hidden md:block col-span-2 text-center font-serif text-sm text-[#eaeaea]/90">
                            {item.product.price.toLocaleString("vi-VN")} VNĐ
                          </div>

                          {/* Quantity Counter */}
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center gap-2">
                            <span className="md:hidden text-xs text-[#eaeaea]/60">{t.quantity}:</span>
                            <div className="flex items-center border border-gold/40 rounded-lg overflow-hidden glass-panel shadow-sm">
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                                className="px-3 py-1.5 text-white hover:text-gold hover:bg-gold/15 text-base font-bold transition-colors cursor-pointer select-none"
                              >
                                -
                              </button>
                              <span className="px-3 py-1.5 font-mono text-sm font-bold text-white min-w-[2.2rem] text-center select-none">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                                className="px-3 py-1.5 text-white hover:text-gold hover:bg-gold/15 text-base font-bold transition-colors cursor-pointer select-none"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Line Total */}
                          <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end">
                            <span className="md:hidden text-xs text-[#eaeaea]/60">{t.subtotalLabel || "Số tiền"}:</span>
                            <span className="font-serif text-base sm:text-lg font-bold text-gold">
                              {(item.product.price * item.quantity).toLocaleString("vi-VN")} VNĐ
                            </span>
                          </div>

                          {/* Action (Delete) */}
                          <div className="col-span-1 md:col-span-1 flex justify-end md:justify-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.product.id)}
                              className="text-white/40 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                              title={lang === "vi" ? "Xóa món này" : "Remove item"}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SHOPEE STYLE STICKY / BOTTOM CHECKOUT BAR */}
                <div className="sticky bottom-4 z-30 p-4 sm:p-5 rounded-2xl glass-panel border border-gold/40 shadow-2xl bg-dark-bg/95 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {/* Left: Select all & Batch remove */}
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                    <label className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-5 h-5 rounded border-gold/50 text-gold focus:ring-gold accent-amber-500 cursor-pointer"
                      />
                      <span>
                        {t.selectAll || (lang === "vi" ? "Chọn tất cả" : "Select All")} ({cart.length})
                      </span>
                    </label>

                    {selectedCartItems.length > 0 && (
                      <button
                        type="button"
                        onClick={removeSelectedItems}
                        className="text-xs text-red-400/80 hover:text-red-400 transition-colors cursor-pointer underline"
                      >
                        {t.deleteSelected || (lang === "vi" ? "Xóa đã chọn" : "Delete Selected")} ({selectedCartItems.length})
                      </button>
                    )}
                  </div>

                  {/* Right: Total payment & Checkout Button */}
                  <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right">
                      <span className="text-[11px] sm:text-xs text-[#eaeaea]/60 block font-light">
                        {t.totalPaymentLabel || (lang === "vi" ? "Tổng thanh toán" : "Total Payment")} ({selectedTotalCount} {lang === "vi" ? "sản phẩm" : "items"}):
                      </span>
                      <span className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-gold">
                        {selectedTotalAmount.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={openCartCheckout}
                      disabled={selectedCartItems.length === 0}
                      className={`font-serif text-xs sm:text-sm md:text-base tracking-wider font-bold py-3.5 px-8 rounded-lg uppercase shadow-xl transition-all duration-300 transform active:scale-95 cursor-pointer whitespace-nowrap ${
                        selectedCartItems.length > 0
                          ? "bg-gold hover:bg-gold-light text-dark-bg shadow-gold/20"
                          : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                      }`}
                    >
                      {t.checkoutBtn || (lang === "vi" ? "MUA HÀNG" : "CHECKOUT")} ({selectedTotalCount})
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : currentView === "products" ? (
          /* ALL PRODUCTS PAGE VIEW (Styled like Langfarm Image 2 with Ocopia aesthetic) */
          <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-10 md:py-14 space-y-8 w-full flex-grow text-left">
            {/* Header info: Title + Total products count */}
            <div className="border-b border-white/10 pb-6 space-y-1.5">
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-white font-light tracking-wide">
                {t.allProductsHeading || "Tất cả sản phẩm"}
              </h1>
              <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light">
                {lang === "vi" 
                  ? `Tổng ${products.length} sản phẩm` 
                  : `Total ${products.length} products`}
              </p>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-24">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gold"></div>
              </div>
            ) : error ? (
              <div className="text-center py-20 text-red-400 font-sans glass-panel p-6 rounded-md max-w-md mx-auto">
                {error}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
                {products.map((product) => {
                  const localizedProduct = t.products?.[String(product.id)];
                  return (
                    <div
                      key={product.id}
                      onClick={() => handleOpenDetail(product)}
                      className="group flex flex-col text-left cursor-pointer transition-all duration-300"
                    >
                      {/* Product Image Box */}
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden glass-panel border border-white/10 group-hover:border-gold/50 transition-all duration-300 shadow-md group-hover:shadow-2xl group-hover:shadow-gold/5">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-500"
                        />
                        {/* Rating / Best-seller Pill Badge */}
                        <div className="absolute top-3 left-3 bg-gold text-dark-bg font-mono font-bold text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-full shadow-md border border-gold-light/40">
                          {product.id === 1 ? "OCOP 4★" : "OCOP 3★"}
                        </div>

                        {/* Quick View Hover overlay */}
                        <div className="absolute inset-0 bg-dark-bg/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-3">
                          <span className="font-serif text-xs font-bold tracking-widest text-dark-bg bg-gold px-4 py-2 rounded-full uppercase shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            {t.viewMore || "XEM CHI TIẾT"} →
                          </span>
                        </div>
                      </div>

                      {/* Product Info below image */}
                      <div className="pt-3 space-y-1">
                        <h3 className="font-serif text-base sm:text-lg font-medium text-white group-hover:text-gold transition-colors line-clamp-2 leading-snug">
                          {localizedProduct?.name || product.name}
                        </h3>
                        <p className="font-sans text-xs text-[#eaeaea]/50 font-light line-clamp-1">
                          {product.id === 1
                            ? (lang === "vi" ? "Hộp 250g" : "250g Box")
                            : (lang === "vi" ? "Hũ 250g" : "250g Jar")}
                        </p>
                        <p className="font-serif text-base sm:text-lg font-bold text-gold pt-0.5">
                          {product.price.toLocaleString("vi-VN")} VNĐ
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          /* HOME VIEW */
          <>
            {/* Hero Banner Carousel (Langfarm Layout with Ocopia Typography & Colors) */}
            {(() => {
              const heroSlides = [
                {
                  productId: 1,
                  tag: lang === "vi" ? "OCOP 4 SAO ĐÀ NẴNG" : "OCOP 4-STAR DA NANG",
                  titleMain: lang === "vi" ? "Bánh khô mè" : "Cam Le Crispy",
                  titleAccent: lang === "vi" ? "đặc sản Ocopia" : "Ocopia Sesame",
                  subtitle: lang === "vi" 
                    ? "Giòn tan từng miếng, vẹn nguyên phong vị đất trời Đà thành" 
                    : "Crispy in every bite, pure Vietnamese natural heritage",
                  desc: lang === "vi"
                    ? "Hạt nếp thơm Bầu rang cát mịn, đượm sốt mía ngọt thanh và áo lớp mè rang củi thơm lừng dâng vua triều Nguyễn."
                    : "Crispy roasted sticky rice, golden sugar cane glaze, and fragrant wood-roasted sesame seeds.",
                  imgMain: "/kho_me.jpg",
                  imgSub: "/g_banh_me_tea.jpg",
                  price: "75.000 VNĐ",
                },
                {
                  productId: 2,
                  tag: lang === "vi" ? "OCOP 3 SAO ĐÀ NẴNG" : "OCOP 3-STAR DA NANG",
                  titleMain: lang === "vi" ? "Mực rim me" : "Tamarind Glazed",
                  titleAccent: lang === "vi" ? "đặc sản Ocopia" : "Ocopia Squid",
                  subtitle: lang === "vi" 
                    ? "Đậm đà cay ngọt, trọn vẹn hương vị biển khơi miền Trung" 
                    : "Rich, sweet, and spicy - the authentic flavor of the Central Sea",
                  desc: lang === "vi"
                    ? "Mực khô hảo hạng hòa quyện cùng sốt me tươi chín mọng, tỏi ớt thơm nồng đượm đà vị mặn mòi xứ biển."
                    : "Sun-cured squid simmered with local ripe tamarind glaze and native aromatic chili.",
                  imgMain: "/muc_rim.jpg",
                  imgSub: "/g_muc_rim_lifestyle.jpg",
                  price: "85.000 VNĐ",
                },
              ];

              const activeSlide = heroSlides[currentSlide] || heroSlides[0];

              return (
                <section className="relative px-4 sm:px-6 md:px-12 lg:px-16 pt-6 pb-10 max-w-7xl mx-auto w-full">
                  <div className="relative rounded-2xl md:rounded-3xl overflow-hidden glass-panel border border-gold/25 shadow-2xl p-6 sm:p-10 md:p-14 lg:p-16 transition-all duration-700">
                    {/* Background ambient lighting */}
                    <div className="absolute -top-24 -right-24 w-96 h-96 bg-gold/15 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-gold-accent/10 rounded-full blur-[100px] pointer-events-none"></div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
                      {/* Left Column: Heading, Subtitle, CTA Pill Button & Slider Dots */}
                      <div className="lg:col-span-7 space-y-6 text-left">
                        {/* Category / OCOP Badge */}
                        <div className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs tracking-[0.25em] text-gold uppercase bg-gold/10 border border-gold/25 px-3.5 py-1.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-ping"></span>
                          <span>{activeSlide.tag}</span>
                        </div>

                        {/* Big Langfarm-style Headline in Ocopia Font */}
                        <div className="space-y-1">
                          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[64px] text-white font-light uppercase tracking-tight leading-[1.08]">
                            {activeSlide.titleMain}
                          </h1>
                          <div className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[54px] gold-gradient-text italic font-normal tracking-wide">
                            {activeSlide.titleAccent}
                          </div>
                        </div>

                        {/* Slogan */}
                        <p className="font-sans text-base sm:text-lg md:text-xl text-[#eaeaea]/85 font-normal leading-relaxed max-w-xl">
                          {activeSlide.subtitle}
                        </p>

                        {/* Secondary Desc */}
                        <p className="font-sans text-xs sm:text-sm text-[#eaeaea]/60 font-light leading-relaxed max-w-lg hidden sm:block">
                          {activeSlide.desc}
                        </p>

                        {/* CTA Button + Price */}
                        <div className="pt-2 flex flex-wrap items-center gap-4 sm:gap-6">
                          <button
                            onClick={() => {
                              const prod = products.find((p) => p.id === activeSlide.productId) || products[0];
                              if (prod) handleOpenDetail(prod);
                            }}
                            className="inline-flex items-center gap-2 bg-gold text-dark-bg font-serif font-bold text-xs sm:text-sm tracking-[0.15em] px-8 sm:px-10 py-3.5 sm:py-4 rounded-full hover:bg-gold-light hover:shadow-xl hover:shadow-gold/25 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer uppercase shadow-lg shadow-gold/10"
                          >
                            <span>{t.heroCta || "Khám phá ngay >>>"}</span>
                          </button>

                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-[#eaeaea]/40 uppercase tracking-widest">{t.unitPrice}</span>
                            <span className="font-serif text-xl sm:text-2xl text-gold font-bold">{activeSlide.price}</span>
                          </div>
                        </div>

                        {/* Slider Pagination Dots (Langfarm style) */}
                        <div className="pt-4 flex items-center gap-2.5">
                          {heroSlides.map((slide, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`transition-all duration-300 rounded-full h-2 ${
                                currentSlide === idx
                                  ? "w-8 bg-gold"
                                  : "w-2.5 bg-gold/30 hover:bg-gold/60"
                              }`}
                              aria-label={`Go to slide ${idx + 1}`}
                            />
                          ))}
                          <span className="font-mono text-[10px] text-[#eaeaea]/40 ml-2 tracking-widest">
                            0{currentSlide + 1} / 0{heroSlides.length}
                          </span>
                        </div>
                      </div>

                      {/* Right Column: Visual Composition (Main Package + Accompaniment Plate like Langfarm) */}
                      <div className="lg:col-span-5 relative flex items-center justify-center py-4">
                        {/* Decorative Circular Backdrop */}
                        <div className="absolute w-72 sm:w-80 md:w-96 aspect-square rounded-full border border-gold/15 bg-gold/[0.02] pointer-events-none"></div>

                        {/* Main Packaging Image */}
                        <div
                          onClick={() => {
                            const prod = products.find((p) => p.id === activeSlide.productId) || products[0];
                            if (prod) handleOpenDetail(prod);
                          }}
                          className="relative z-20 w-56 sm:w-64 md:w-72 aspect-[3/4] rounded-2xl overflow-hidden glass-panel border-2 border-gold/40 shadow-2xl shadow-black/60 transform hover:scale-103 transition-transform duration-500 cursor-pointer group"
                        >
                          <img
                            src={activeSlide.imgMain}
                            alt={activeSlide.titleMain}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-dark-bg/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <span className="font-serif text-xs text-gold tracking-widest uppercase font-bold">
                              {t.viewMore} →
                            </span>
                          </div>
                        </div>

                        {/* Secondary Accompaniment Plate (Basket/Tray style like Langfarm) */}
                        <div className="absolute -bottom-2 -right-1 sm:-bottom-4 sm:-right-4 md:-bottom-6 md:right-2 z-30 w-32 sm:w-36 md:w-44 aspect-square rounded-full overflow-hidden border-2 border-gold/60 shadow-2xl glass-panel transform rotate-6 hover:rotate-0 transition-transform duration-500 pointer-events-none">
                          <img
                            src={activeSlide.imgSub}
                            alt="Lifestyle pairing"
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Star Rating Badge */}
                        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-30 bg-gold text-dark-bg font-mono font-bold text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full shadow-lg border border-gold-light/40 flex items-center gap-1">
                          <span>★</span>
                          <span>{activeSlide.tag.includes("4") ? "4 SAO" : "3 SAO"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })()}

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
          </>
        )}
      </main>

      {/* Checkout Modal */}
      {renderCheckoutModal()}

      {/* PayOS Redirect Status Modal */}
      {renderRedirectStatusModal()}

      {/* Footer */}
      <footer id="about" className="border-t border-white/5 py-10 px-6 md:px-12 bg-dark-bg/60 text-center">
        <div className="max-w-2xl mx-auto space-y-2">
          <span className="font-serif text-xl tracking-[0.2em] gold-gradient-text uppercase font-bold block">
            OCOPIA HERITAGE
          </span>
          <p className="font-mono text-xs sm:text-sm text-gold-accent tracking-widest">
            {lang === "vi" ? "Liên hệ" : "Hotline"}: 0787755835
          </p>
        </div>
      </footer>
    </div>
  );
}