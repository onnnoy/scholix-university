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
