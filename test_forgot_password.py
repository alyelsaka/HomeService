from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import UnexpectedAlertPresentException, NoAlertPresentException
import time

# Set up WebDriver (replace with your WebDriver path if needed)
try:
    driver = webdriver.Chrome()
except Exception as e:
    print("Error: Could not start WebDriver. Ensure ChromeDriver is installed and in your PATH.")
    print(e)
    exit(1)

try:
    # Open the login page
    print("Opening login page...")
    driver.get("http://localhost:5002/login.html")  # Replace with your app's URL
    time.sleep(2)  # Wait for the page to load

    # Find email and password fields and enter valid credentials
    email_field = driver.find_element(By.ID, "email")
    password_field = driver.find_element(By.ID, "password")
    login_button = driver.find_element(By.ID, "loginButton")

    email_field.send_keys("ali@example.com")  # Replace with a valid email
    password_field.send_keys("123")   # Replace with a valid password
    login_button.click()

    time.sleep(2)  # Wait for the login to complete

    # Handle the alert if it appears
    try:
        alert = driver.switch_to.alert
        alert_text = alert.text
        print(f"Alert detected: {alert_text}")
        alert.accept()  # Accept the alert (click OK)
    except NoAlertPresentException:
        print("No alert detected.")

    # Verify login success
    welcome_message = driver.find_element(By.TAG_NAME, "h2").text
    assert "Welcome Back" in welcome_message, "Login failed!"

    print("Login test passed!")

except UnexpectedAlertPresentException as e:
    print("Error: An unexpected alert was present.")
    print(e)
except Exception as e:
    print("Error: An issue occurred while running the test.")
    print(e)

finally:
    # Close the browser
    driver.quit()
    print("Browser closed.")