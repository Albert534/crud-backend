const express = require('express');
const app = express();
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');

app.use(express.json());
app.use(cors());
// Serve static files from the "public" folder
app.use('/photo', express.static(path.join(__dirname, 'public/photo')));

dotenv.config({ path: './config.env' });

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'public/photo'); // Path to store uploaded files
	},
	filename: (req, file, cb) => {
		cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
	},
});

const upload = multer({ storage: storage });

const pool = new Pool({
	user: process.env.PG_USER,
	host: process.env.PG_HOST,
	database: process.env.PG_DATABASE,
	password: process.env.PG_PASSWORD,
	port: process.env.PG_PORT,
	ssl: {
		rejectUnauthorized: false,
	},
});

pool.connect((err, client, release) => {
	if (err) {
		console.error('Database connection Error', err.stack);
	} else {
		console.log('Database is connected successfully!');
	}
	release();
});
app.get('/getProduct', async (req, res) => {
	try {
		const result = await pool.query('SELECT * FROM product');

		res.status(200).json({
			products: result.rows,
		});
	} catch (err) {
		res.status(500).send('Error fetching Products', err.message);
	}
});

app.post('/createProduct', upload.single('photo'), async (req, res) => {
	let { name, quantity, price, photo } = req.body;
	photo = req.file ? req.file.filename : null;
	try {
		const result = await pool.query(
			'INSERT INTO product (name, quantity, price, photo) VALUES ($1, $2, $3, $4) RETURNING id',
			[name, quantity, price, photo]
		);
		res.status(200).json({
			data: result.rows[0],
		});
	} catch (err) {
		res.status(500).json({ message: 'Server Error' });
	}
});

app.delete('/deleteProduct/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const result = await pool.query(
			'DELETE FROM product WHERE id = $1 RETURNING id',
			[id]
		);

		if (result.rowCount === 0) {
			return res.status(404).json({ message: 'Product not found' });
		}

		res.status(200).json({ message: 'Product deleted successfully' });
	} catch (error) {
		console.error('Error deleting product:', error.message);
		res.status(500).json({ message: 'Internal Server Error' });
	}
});

app.put('/editProduct/:id', upload.single('photo'), async (req, res) => {
	const index = req.params.id;
	let { name, price, quantity } = req.body; // Extract form data
	let photo = req.file ? req.file.filename : null; // Extract the filename if present

	console.log('Received form data:', req.body); // Log form data to check for 'name'
	console.log('Received photo file:', req.file); // Log photo file if it was uploaded

	if (!name) {
		return res.status(400).json({ message: 'Name field cannot be empty' });
	}

	try {
		// Fetch the existing product data before updating
		const existingProductResult = await pool.query(
			'SELECT photo FROM product WHERE id = $1',
			[index]
		);

		if (existingProductResult.rowCount === 0) {
			return res.status(404).json({ message: 'Product not found' });
		}

		const existingPhoto = existingProductResult.rows[0].photo;

		// If no new photo is provided, use the existing photo
		if (!photo) {
			photo = existingPhoto;
		}

		// Update the product with the new details, including the photo (if provided)
		const result = await pool.query(
			'UPDATE product SET name = $1, price = $2, quantity = $3, photo = $4 WHERE id = $5 RETURNING id',
			[name, price, quantity, photo, index]
		);

		if (result.rowCount === 0) {
			return res.status(404).json({
				message: 'The selected item to edit is not in your list.',
			});
		}

		res.status(200).json({
			message: 'Product is edited successfully',
			updatedProduct: result.rows[0],
		});
	} catch (err) {
		console.log('Error while updating the product', err.message);
		res.status(500).json({ message: 'Internal Server Error!!!' });
	}
});

app.listen(process.env.PORT, () => {
	console.log(`server is running on port ${process.env.PORT}`);
});
