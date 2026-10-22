CREATE DATABASE IF NOT EXISTS digital_library
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE digital_library;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Fines;
DROP TABLE IF EXISTS Borrowing;
DROP TABLE IF EXISTS Books;
DROP TABLE IF EXISTS Authors;
DROP TABLE IF EXISTS Users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE Users (
  User_ID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(150) NOT NULL UNIQUE,
  Phone VARCHAR(20),
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Authors (
  Author_ID INT AUTO_INCREMENT PRIMARY KEY,
  Author_Name VARCHAR(150) NOT NULL
);

CREATE TABLE Books (
  Book_ID INT AUTO_INCREMENT PRIMARY KEY,
  Title VARCHAR(200) NOT NULL,
  Author_ID INT NULL,
  Category VARCHAR(100),
  ISBN VARCHAR(20) UNIQUE,
  Total_Copies INT NOT NULL DEFAULT 1,
  Available_Copies INT NOT NULL DEFAULT 1,
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_books_author FOREIGN KEY (Author_ID)
    REFERENCES Authors(Author_ID) ON DELETE SET NULL,
  CONSTRAINT chk_total_copies CHECK (Total_Copies >= 0),
  CONSTRAINT chk_available_copies CHECK (Available_Copies >= 0 AND Available_Copies <= Total_Copies)
);

CREATE TABLE Borrowing (
  Borrow_ID INT AUTO_INCREMENT PRIMARY KEY,
  User_ID INT NOT NULL,
  Book_ID INT NOT NULL,
  Issue_Date DATE NOT NULL,
  Due_Date DATE NOT NULL,
  Return_Date DATE NULL,
  CONSTRAINT fk_borrow_user FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
  CONSTRAINT fk_borrow_book FOREIGN KEY (Book_ID) REFERENCES Books(Book_ID),
  INDEX idx_borrow_user (User_ID),
  INDEX idx_borrow_book (Book_ID)
);

CREATE TABLE Fines (
  Fine_ID INT AUTO_INCREMENT PRIMARY KEY,
  User_ID INT NOT NULL,
  Borrow_ID INT NULL,
  Amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  Payment_Status ENUM('Pending','Paid') NOT NULL DEFAULT 'Pending',
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fine_user FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
  CONSTRAINT fk_fine_borrow FOREIGN KEY (Borrow_ID) REFERENCES Borrowing(Borrow_ID) ON DELETE SET NULL
);

INSERT INTO Authors (Author_Name) VALUES
('R. K. Narayan'), ('J. K. Rowling'), ('J. R. R. Tolkien'), ('Sudha Murty');

INSERT INTO Books (Title, Author_ID, Category, ISBN, Total_Copies, Available_Copies) VALUES
('Malgudi Days', 1, 'Fiction', '9780143039655', 3, 3),
('Harry Potter and the Philosopher''s Stone', 2, 'Fantasy', '9780747532699', 4, 4),
('The Hobbit', 3, 'Fantasy', '9780547928227', 2, 2),
('Wise and Otherwise', 4, 'Short Stories', '9780143062227', 2, 2);

INSERT INTO Users (Name, Email, Phone) VALUES
('Lakshmi', 'lakshmi@example.com', '9876543210'),
('Asha Rao', 'asha@example.com', '9876501234');

INSERT INTO Borrowing (User_ID, Book_ID, Issue_Date, Due_Date, Return_Date) VALUES
(1, 1, CURRENT_DATE - INTERVAL 14 DAY, CURRENT_DATE - INTERVAL 7 DAY, NULL);
UPDATE Books SET Available_Copies = Available_Copies - 1 WHERE Book_ID = 1;

INSERT INTO Fines (User_ID, Borrow_ID, Amount, Payment_Status)
VALUES (1, 1, 25.00, 'Pending');
