#!/bin/bash
# RAG Comparison Test Runner - Linux/macOS
# Test script để so sánh GraphRAG vs Traditional RAG

set -e

echo ""
echo "==============================================================================="
echo "      RAG COMPARISON TEST RUNNER"
echo "      Platform: Linux/macOS"
echo "==============================================================================="
echo ""

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "[ERROR] Python not found. Please install Python 3.10+"
    exit 1
fi

echo "[OK] Python found:"
python --version

# Navigate to api directory
cd "$(dirname "$0")/api" || exit 1

if [ ! -f test_rag_comparison.py ]; then
    echo "[ERROR] Test script not found. Please run from project root."
    exit 1
fi

# Display menu
show_menu() {
    echo ""
    echo "==============================================================================="
    echo "CHOOSE TEST MODE:"
    echo "==============================================================================="
    echo "1. Quick Test (5 samples) - Rapid validation"
    echo "2. Standard Test (10 samples) - Recommended"
    echo "3. Full Test (all samples) - Comprehensive evaluation"
    echo "4. Exit"
    echo ""
    read -p "Enter your choice (1-4): " choice
}

# Process selection
while true; do
    show_menu
    
    case $choice in
        1)
            echo ""
            echo "Running QUICK TEST..."
            echo ""
            python test_rag_quick.py
            break
            ;;
        2)
            echo ""
            echo "Running STANDARD TEST (10 samples)..."
            echo ""
            # Temporarily modify num_samples
            sed 's/"num_samples": None/"num_samples": 10/' test_rag_comparison.py > test_rag_comparison_temp.py
            python test_rag_comparison_temp.py
            rm test_rag_comparison_temp.py
            break
            ;;
        3)
            echo ""
            echo "Running FULL TEST (all samples)..."
            echo "This may take several minutes..."
            echo ""
            python test_rag_comparison.py
            break
            ;;
        4)
            echo ""
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid choice. Please try again."
            ;;
    esac
done

echo ""
echo "==============================================================================="
echo "TEST COMPLETED"
echo "Results saved to: rag_test_results/"
echo "==============================================================================="
echo ""
