self.addEventListener("push", event => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || "Я тебя люблю", {
      body: data.body || "Я тебя люблю",
      icon: data.icon || "/icon-heart.svg",
      badge: data.badge || "/badge-heart.svg"
    })
  );
});
