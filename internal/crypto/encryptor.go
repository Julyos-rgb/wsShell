package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"runtime"
	"unsafe"
)

var masterKey []byte

func InitMasterKey() error {
	if masterKey != nil {
		return nil
	}

	keyPath := getKeyPath()
	data, err := os.ReadFile(keyPath)
	if err == nil && len(data) == 32 {
		masterKey = data
		return nil
	}

	if os.IsNotExist(err) || len(data) != 32 {
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return fmt.Errorf("generate key: %w", err)
		}
		masterKey = key

		if err := os.MkdirAll(getKeyDir(), 0700); err != nil {
			return fmt.Errorf("create key dir: %w", err)
		}
		if err := os.WriteFile(keyPath, key, 0600); err != nil {
			return fmt.Errorf("write key: %w", err)
		}
		return nil
	}
	return fmt.Errorf("read key: %w", err)
}

func getKeyDir() string {
	if runtime.GOOS == "windows" {
		localAppData := os.Getenv("LOCALAPPDATA")
		if localAppData == "" {
			localAppData = os.Getenv("APPDATA")
		}
		return fmt.Sprintf(`%s\wsShell`, localAppData)
	}
	home, _ := os.UserHomeDir()
	return fmt.Sprintf("%s/.wsShell/keys", home)
}

func getKeyPath() string {
	return fmt.Sprintf("%s/master.key", getKeyDir())
}

func Encrypt(plaintext string) (string, error) {
	if masterKey == nil {
		if err := InitMasterKey(); err != nil {
			return "", err
		}
	}
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, aesGCM.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := aesGCM.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func Decrypt(encoded string) (string, error) {
	if masterKey == nil {
		if err := InitMasterKey(); err != nil {
			return "", err
		}
	}
	if encoded == "" {
		return "", nil
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(masterKey)
	if err != nil {
		return "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := aesGCM.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := aesGCM.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return unsafe.String(unsafe.SliceData(plaintext), len(plaintext)), nil
}
