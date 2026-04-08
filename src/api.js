const API_BASE = "/api";

function withAuth(token, options = {}) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };
}

async function request(path, options = {}) {
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || "请求失败");
  }

  return response.json();
}

export const api = {
  login(payload) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sendOtp(phone) {
    return request("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },
  register(payload) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  resetPassword(payload) {
    return request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getDashboard(token) {
    return request("/dashboard", withAuth(token));
  },
  recognizePlate(token, payload) {
    return request("/ocr/recognize", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  createEntry(token, payload) {
    return request("/entries", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  createExit(token, payload) {
    return request("/exits", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  updatePricing(token, payload) {
    return request("/billing/config", withAuth(token, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },
  updateSpace(token, code, payload) {
    return request(`/spaces/${code}`, withAuth(token, {
      method: "PUT",
      body: JSON.stringify(payload),
    }));
  },
  createUserReservation(token, payload) {
    return request("/user/reservations", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  checkoutUserParking(token, payload) {
    return request("/user/checkout", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  createSupportTicket(token, payload) {
    return request("/user/support-tickets", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  requestInvoice(token, payload) {
    return request("/user/invoices", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
  renewMembership(token, payload) {
    return request("/user/membership/renewals", withAuth(token, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  },
};
