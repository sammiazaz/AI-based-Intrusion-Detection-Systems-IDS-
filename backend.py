from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
import time
import random
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

app = Flask(__name__)
CORS(app)

# ─── Global Model State ───────────────────────────────────────────────────────
model_state = {
    'model': None,
    'accuracy': 0.0,
    'trained': False,
    'feature_columns': None
}


def generate_traffic_data(n_samples=1000, seed=None):
    """Generates synthetic high-fidelity CIC-IDS2017-like traffic data."""
    if seed is not None:
        np.random.seed(seed)
    else:
        np.random.seed(int(time.time() % 1000))

    data = []
    for _ in range(n_samples):
        label = random.choice(["Normal", "DDoS", "Brute Force", "Malware"])

        if label == "Normal":
            duration  = np.random.uniform(0.1, 2.0)
            src_bytes = np.random.randint(100, 5000)
            dst_bytes = np.random.randint(100, 5000)
            count     = np.random.randint(1, 10)
        elif label == "DDoS":
            duration  = np.random.uniform(0.01, 0.1)
            src_bytes = np.random.randint(5000, 10000)
            dst_bytes = np.random.randint(10, 100)
            count     = np.random.randint(50, 200)
        elif label == "Brute Force":
            duration  = np.random.uniform(2.0, 10.0)
            src_bytes = np.random.randint(50, 200)
            dst_bytes = np.random.randint(50, 200)
            count     = np.random.randint(20, 50)
        else:  # Malware
            duration  = np.random.uniform(5.0, 60.0)
            src_bytes = np.random.randint(1000, 20000)
            dst_bytes = np.random.randint(1000, 20000)
            count     = np.random.randint(1, 5)

        data.append([duration, src_bytes, dst_bytes, count, label])

    return pd.DataFrame(data, columns=['Duration', 'Src_Bytes', 'Dst_Bytes', 'Conn_Count', 'Label'])


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/status')
def get_status():
    return jsonify({
        'trained':  model_state['trained'],
        'accuracy': round(model_state['accuracy'], 2),
        'status':   'Active'
    })


@app.route('/api/train', methods=['POST'])
def train_model():
    df = generate_traffic_data(5000, seed=42)
    X  = df.drop('Label', axis=1)
    y  = df['Label']
    X  = pd.get_dummies(X)

    model_state['feature_columns'] = list(X.columns)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    clf.fit(X_train, y_train)

    model_state['model']    = clf
    model_state['accuracy'] = clf.score(X_test, y_test) * 100
    model_state['trained']  = True

    y_pred       = clf.predict(X_test)
    report       = classification_report(y_test, y_pred, output_dict=True)
    label_counts = df['Label'].value_counts().to_dict()

    return jsonify({
        'accuracy':     round(model_state['accuracy'], 2),
        'report':       report,
        'label_counts': label_counts,
        'samples':      len(df)
    })


@app.route('/api/predict')
def predict_packet():
    if not model_state['trained']:
        return jsonify({'error': 'Model not trained yet'}), 400

    test_df  = generate_traffic_data(1)
    features = test_df.drop('Label', axis=1)
    features = pd.get_dummies(features)

    # Align columns with training schema
    for col in model_state['feature_columns']:
        if col not in features.columns:
            features[col] = 0
    features = features[model_state['feature_columns']]

    prediction = model_state['model'].predict(features)[0]

    return jsonify({
        'prediction': prediction,
        'duration':   round(float(test_df['Duration'].values[0]), 4),
        'src_bytes':  int(test_df['Src_Bytes'].values[0]),
        'dst_bytes':  int(test_df['Dst_Bytes'].values[0]),
        'conn_count': int(test_df['Conn_Count'].values[0]),
        'timestamp':  time.strftime("%H:%M:%S"),
        'is_threat':  prediction != "Normal"
    })


if __name__ == '__main__':
    print("\n  AstraGuard AI Backend starting...")
    print("  Open http://127.0.0.1:5000 in your browser\n")
    app.run(port=5000, debug=False)
