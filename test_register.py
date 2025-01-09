from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
import time

# Set up WebDriver (replace with your WebDriver path if needed)
driver = webdriver.Chrome()

try:
    # Open the registration page
    driver.get("http://localhost:5002/register.html")  # Replace with your app's URL
    time.sleep(2)  # Wait for the page to load

    # Find registration fields and enter details
    full_name_field = driver.find_element(By.NAME, "full_name")
    email_field = driver.find_element(By.NAME, "email")
    phone_field = driver.find_element(By.NAME, "phonenumber")
    password_field = driver.find_element(By.NAME, "password")
    user_type_dropdown = Select(driver.find_element(By.ID, "userType"))
    register_button = driver.find_element(By.ID, "registerBtn")

    full_name_field.send_keys("mohamed Doe")
    email_field.send_keys("mohamed@example.com")
    phone_field.send_keys("1234567890")
    password_field.send_keys("password123")
    user_type_dropdown.select_by_value("client")
    register_button.click()

    time.sleep(2)  # Wait for the registration to complete

    # Verify registration success
    success_message = driver.find_element(By.TAG_NAME, "body").text
    assert "Registration successful" in success_message, "Registration failed!"

    print("Registration test passed!")

finally:
    # Close the browser
    driver.quit()