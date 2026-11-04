import { expect, test } from "@playwright/test";

test("shows the Scholix academic dashboard in local preview mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard overview" })).toBeVisible();
  await expect(page.getByText("Demo data")).toBeVisible();
  await expect(page.getByText("Total Students")).toBeVisible();
});

test("shows the main academic navigation", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Students" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Result Processing" })).toBeVisible();
});


test("shows the sign-out action and returns to login after signing out", async ({ page }) => {
  await page.goto("/admin/dashboard");
  const signOut = page.getByRole("button", { name: "Sign out" });
  await expect(signOut).toBeVisible();
  await signOut.click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();
});

test("mobile admin navigation is named, keyboard dismissible, and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/dashboard");
  const openButton = page.getByRole("button", { name: "Open navigation" });
  await openButton.click();
  await expect(page.getByRole("dialog", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Main navigation" })).toBeHidden();
  await expect(openButton).toBeFocused();
});
